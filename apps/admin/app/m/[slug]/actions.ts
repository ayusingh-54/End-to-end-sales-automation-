'use server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { renderTemplate } from '@lwl/shared';
import { pickProvider } from '@/lib/email';
import { buildIcs } from '@/lib/ics';
import { consume } from '@/lib/rate-limit';
import { headers } from 'next/headers';

const Input = z.object({
  first_name: z.string().min(1).max(60),
  last_name: z.string().min(1).max(60),
  email: z.string().email(),
  school: z.string().min(1).max(160),
  lead_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

interface MasterclassRow {
  id: string;
  topic: string;
  mentor_name: string;
  scheduled_at: string;
  duration_minutes: number;
  zoom_join_url: string | null;
  program_id: string;
}
interface TemplateRow {
  subject: string;
  body_md: string;
  variables: string[];
}

export async function register(
  slug: string,
  form: FormData,
): Promise<{ ok: boolean; message: string }> {
  const ip = headers().get('x-forwarded-for') ?? 'local';
  if (!consume(`register:${ip}`, { capacity: 8, refillPerSecond: 0.2 })) {
    return { ok: false, message: 'Too many attempts — try again in a minute.' };
  }
  const parsed = Input.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { ok: false, message: 'Please check your details and try again.' };
  }
  const { first_name, last_name, email, school, lead_id } = parsed.data;

  const idem = createHash('sha256')
    .update(`${slug}|${(lead_id ?? email).toLowerCase()}`)
    .digest('hex')
    .slice(0, 32);

  const db = createSupabaseAdmin();
  const { data: regResult, error: regErr } = await db.rpc('register_for_masterclass', {
    p_masterclass_slug: slug,
    p_idempotency_key: idem,
    p_first_name: first_name,
    p_last_name: last_name,
    p_email: email,
    p_school_name: school,
  });
  if (regErr) {
    return {
      ok: false,
      message: 'We could not register you — please email hello@learnwithleaders.com.',
    };
  }

  // Fetch masterclass + confirmation template; send confirmation. Best-effort.
  const { data: mcData } = await db
    .from('masterclasses')
    .select('id, topic, mentor_name, scheduled_at, duration_minutes, zoom_join_url, program_id')
    .eq('registration_page_slug', slug)
    .maybeSingle();
  if (mcData) {
    const mc = mcData as MasterclassRow;
    const { data: tplData } = await db
      .from('email_templates')
      .select('subject, body_md, variables')
      .eq('program_id', mc.program_id)
      .eq('kind', 'registration_confirmation')
      .maybeSingle();
    if (tplData) {
      const tpl = tplData as TemplateRow;
      const ics = buildIcs({
        uid: `${idem}@learnwithleaders.com`,
        start: new Date(mc.scheduled_at),
        durationMinutes: mc.duration_minutes,
        title: mc.topic,
        description: `Masterclass with ${mc.mentor_name}. Join link: ${mc.zoom_join_url ?? 'TBD'}`,
        url: mc.zoom_join_url ?? undefined,
        organizer: {
          name: 'Learn with Leaders',
          email: process.env.EMAIL_FROM_ADDRESS ?? 'hello@learnwithleaders.com',
        },
      });
      const ics_url = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
      const rendered = renderTemplate(tpl, {
        first_name,
        masterclass_topic: mc.topic,
        mentor_name: mc.mentor_name,
        masterclass_time: new Date(mc.scheduled_at).toUTCString(),
        zoom_join_url: mc.zoom_join_url ?? '',
        ics_url,
      });
      try {
        const provider = pickProvider('transactional');
        await provider.send({
          to: email,
          toName: `${first_name} ${last_name}`,
          fromAddress: process.env.EMAIL_FROM_ADDRESS ?? 'fdf@learnwithleaders.com',
          fromName: process.env.EMAIL_FROM_NAME ?? 'Learn with Leaders',
          replyTo: process.env.EMAIL_REPLY_TO,
          subject: rendered.subject,
          textBody: rendered.text,
          idempotencyKey: `confirm:${idem}`,
        });
      } catch {
        // Confirmation email is best-effort; registration is already saved.
      }
    }
  }

  void regResult;
  return {
    ok: true,
    message: 'You’re in. Check your inbox for the calendar invite and join link.',
  };
}
