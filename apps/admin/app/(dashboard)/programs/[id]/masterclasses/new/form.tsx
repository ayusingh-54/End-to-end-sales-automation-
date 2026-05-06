'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createMasterclass } from './actions';

function defaultDateTime(): string {
  const t = new Date(Date.now() + 86_400_000);
  t.setUTCHours(14, 0, 0, 0);
  // datetime-local needs YYYY-MM-DDTHH:MM (local, no Z, no seconds)
  return t.toISOString().slice(0, 16);
}

function previewSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function MasterclassForm({ programId }: { programId: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [slugRaw, setSlugRaw] = useState('');
  const router = useRouter();
  const slugClean = previewSlug(slugRaw);

  return (
    <form
      action={(form) => {
        setErr(null);
        start(async () => {
          const res = await createMasterclass(programId, form);
          if (!res.ok) {
            setErr(res.error);
            return;
          }
          // refresh BEFORE navigating so the destination page sees the new row
          router.refresh();
          router.push('/programs');
        });
      }}
      className="mt-6 space-y-4 text-sm"
    >
      <Field label="Topic" required>
        <input
          name="topic"
          required
          placeholder="Med-school admissions strategy"
          className={inputClass}
        />
      </Field>
      <Field label="Mentor name" required>
        <input name="mentor_name" required placeholder="Dr. Test Mentor" className={inputClass} />
      </Field>
      <Field label="Mentor bio (optional)">
        <textarea
          name="mentor_bio"
          rows={3}
          placeholder="2-3 lines about the mentor"
          className={inputClass}
        />
      </Field>
      <Field label="Scheduled at (UTC)" required>
        <input
          name="scheduled_at"
          type="datetime-local"
          required
          defaultValue={defaultDateTime()}
          className={inputClass}
        />
      </Field>
      <Field label="Duration (minutes)" required>
        <input
          name="duration_minutes"
          type="number"
          min={15}
          max={240}
          defaultValue={60}
          className={inputClass}
        />
      </Field>
      <Field label="Zoom join URL (optional)">
        <input
          name="zoom_join_url"
          type="url"
          placeholder="https://zoom.us/j/..."
          className={inputClass}
        />
      </Field>
      <Field label="Zoom meeting ID (optional)">
        <input name="zoom_meeting_id" placeholder="123 4567 8901" className={inputClass} />
      </Field>
      <Field label="Registration page slug" required>
        <input
          name="registration_page_slug"
          required
          minLength={3}
          maxLength={80}
          placeholder="fdf-may-cohort"
          value={slugRaw}
          onChange={(e) => setSlugRaw(e.target.value)}
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-neutral-500">
          Public URL will be{' '}
          <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">
            /m/{slugClean || '<slug>'}
          </code>
          . Lowercase letters / digits / hyphens only — anything else gets cleaned automatically.
        </span>
      </Field>

      {err && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300">
          {err}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {pending ? 'Creating…' : 'Create masterclass'}
      </button>
    </form>
  );
}

const inputClass =
  'mt-1 w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900';

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase text-neutral-500">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
