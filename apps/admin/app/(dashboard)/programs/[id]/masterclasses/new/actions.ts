'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createSupabaseAdmin } from '@/lib/supabase/server';

function sanitizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const Input = z.object({
  topic: z.string().min(1).max(160),
  mentor_name: z.string().min(1).max(120),
  mentor_bio: z.string().max(2000).optional(),
  scheduled_at: z.string().min(1),
  duration_minutes: z.coerce.number().int().min(15).max(240).default(60),
  zoom_join_url: z.string().url().optional(),
  zoom_meeting_id: z.string().max(80).optional(),
  registration_page_slug: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
});

export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

export async function createMasterclass(programId: string, form: FormData): Promise<CreateResult> {
  const raw: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (trimmed !== '') raw[k] = trimmed;
    }
  }
  if (raw.registration_page_slug) {
    raw.registration_page_slug = sanitizeSlug(raw.registration_page_slug);
  }

  const parsed = Input.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (!issue) return { ok: false, error: 'Invalid input' };
    const field = issue.path.join('.') || 'input';
    return { ok: false, error: `${field}: ${issue.message}` };
  }

  let scheduledIso: string;
  try {
    scheduledIso = new Date(parsed.data.scheduled_at).toISOString();
  } catch {
    return { ok: false, error: 'scheduled_at: invalid date format' };
  }

  const db = createSupabaseAdmin();
  const { data, error } = await db
    .from('masterclasses')
    .insert({
      program_id: programId,
      topic: parsed.data.topic,
      mentor_name: parsed.data.mentor_name,
      mentor_bio: parsed.data.mentor_bio ?? null,
      scheduled_at: scheduledIso,
      duration_minutes: parsed.data.duration_minutes,
      zoom_join_url: parsed.data.zoom_join_url ?? null,
      zoom_meeting_id: parsed.data.zoom_meeting_id ?? null,
      registration_page_slug: parsed.data.registration_page_slug,
      status: 'scheduled',
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        error: `Slug "${parsed.data.registration_page_slug}" already in use — try another`,
      };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath('/dashboard');
  revalidatePath('/programs');
  return { ok: true, id: (data as { id: string }).id };
}
