'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { signRequest } from '@/lib/hmac';
import { CampaignStatus } from '@lwl/shared';

const NewCampaign = z.object({
  program_id: z.string().uuid(),
  masterclass_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  name: z.string().min(1).max(120),
  daily_send_cap: z.coerce.number().int().min(10).max(2000).default(200),
});

export async function createCampaign(form: FormData) {
  const parsed = NewCampaign.parse(Object.fromEntries(form));
  const db = createSupabaseAdmin();
  const { data, error } = await db
    .from('campaigns')
    .insert({
      program_id: parsed.program_id,
      masterclass_id: parsed.masterclass_id ?? null,
      name: parsed.name,
      daily_send_cap: parsed.daily_send_cap,
      status: 'draft',
    })
    .select('id')
    .single();
  if (error) throw error;
  revalidatePath('/campaigns');
  return data;
}

export async function setCampaignStatus(id: string, status: string) {
  const next = CampaignStatus.parse(status);
  const db = createSupabaseAdmin();
  await db
    .from('campaigns')
    .update({
      status: next,
      started_at: next === 'running' ? new Date().toISOString() : undefined,
      ended_at: next === 'done' ? new Date().toISOString() : undefined,
    })
    .eq('id', id);

  if (next === 'running' && process.env.N8N_WEBHOOK_URL && process.env.N8N_WEBHOOK_SECRET) {
    const body = JSON.stringify({ campaign_id: id, action: 'start' });
    const { ts, sig } = signRequest(process.env.N8N_WEBHOOK_SECRET, body);
    await fetch(`${process.env.N8N_WEBHOOK_URL}/start_campaign`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-lwl-ts': ts, 'x-lwl-sig': sig },
      body,
    }).catch(() => undefined);
  }
  revalidatePath('/campaigns');
}
