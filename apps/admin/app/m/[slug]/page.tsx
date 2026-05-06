import { notFound } from 'next/navigation';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { RegistrationForm } from './registration-form';
import { Icon, type IconName } from '@/components/Icon';

interface MasterclassRow {
  id: string;
  topic: string;
  mentor_name: string;
  mentor_bio: string | null;
  scheduled_at: string;
  duration_minutes: number;
  registration_page_slug: string;
  status: string;
}

export const dynamic = 'force-dynamic';

export default async function MasterclassPage({ params }: { params: { slug: string } }) {
  const db = createSupabaseAdmin();
  const slug = params.slug.trim().toLowerCase();
  const { data: rows, error } = await db
    .from('masterclasses')
    .select(
      'id, topic, mentor_name, mentor_bio, scheduled_at, duration_minutes, registration_page_slug, status',
    )
    .ilike('registration_page_slug', slug)
    .limit(1);
  const data = rows && rows.length > 0 ? rows[0] : null;

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Could not load this page</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{error.message}</p>
      </main>
    );
  }
  if (!data) notFound();
  const mc = data as MasterclassRow;
  if (mc.status === 'cancelled') notFound();

  const when = new Date(mc.scheduled_at);
  const initials = mc.mentor_name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-neutral-50 dark:from-neutral-950 dark:to-neutral-900">
      {/* Top bar */}
      <header className="border-b border-neutral-200 bg-white/70 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/70">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-neutral-900 text-xs font-bold text-white dark:bg-white dark:text-neutral-900">
              LWL
            </span>
            <span>Learn with Leaders</span>
          </div>
          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            Free masterclass
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-14 pb-10 sm:pt-20">
        <div className="grid gap-12 md:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
              Future Doctors Fellowship
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              {mc.topic}
            </h1>
            <p className="mt-4 text-base text-neutral-600 dark:text-neutral-400 sm:text-lg">
              A 60-minute live session for high-school students serious about medicine — and the
              counsellors who guide them.
            </p>

            <ul className="mt-8 space-y-3 text-sm">
              <Bullet>
                What it takes to get into a top med-school today (admit-rate realities)
              </Bullet>
              <Bullet>How to build a research / clinical résumé in high school</Bullet>
              <Bullet>BS/MD vs traditional path — choosing the right one</Bullet>
              <Bullet>Live Q&amp;A with {mc.mentor_name}</Bullet>
            </ul>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-neutral-600 dark:text-neutral-400">
              <Meta
                icon="calendar"
                label={when.toLocaleString('en-US', { dateStyle: 'full', timeZone: 'UTC' })}
              />
              <Meta
                icon="clock"
                label={`${when.toLocaleString('en-US', { timeStyle: 'short', timeZone: 'UTC' })} UTC · ${mc.duration_minutes} min`}
              />
              <Meta icon="video" label="Live on Zoom" />
            </div>

            <div className="mt-8 flex items-center gap-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900">
                {initials || 'M'}
              </div>
              <div>
                <p className="text-sm font-medium">{mc.mentor_name}</p>
                <p className="text-xs text-neutral-500">Hosting this session</p>
              </div>
            </div>

            {mc.mentor_bio && (
              <p className="mt-4 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                {mc.mentor_bio}
              </p>
            )}
          </div>

          {/* Registration card */}
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 sm:p-8">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Reserve your seat</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Free · No credit card</h2>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                You&apos;ll get the Zoom link + calendar invite immediately after signing up.
              </p>
              <RegistrationForm slug={mc.registration_page_slug} />
              <p className="mt-4 text-[11px] text-neutral-500">
                We send a confirmation, two reminder emails, and a follow-up after the session. No
                spam — unsubscribe anytime.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              <Pill value="3,200+" label="Students mentored" />
              <Pill value="14" label="Active programs" />
              <Pill value="62%" label="Top-20 admit rate" />
            </div>
          </aside>
        </div>
      </section>

      {/* Social proof / testimonials strip */}
      <section className="border-y border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <p className="text-center text-xs uppercase tracking-[0.2em] text-neutral-500">
            What past attendees say
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <Quote
              text="Walked into med-school interviews like she'd been doing them for years."
              by="Parent · Class of 2025"
            />
            <Quote
              text="The clarity on BS/MD vs traditional alone was worth the hour."
              by="College counsellor, NJ private school"
            />
            <Quote
              text="My students got more from this 60 minutes than from a semester of guidance."
              by="Pre-med advisor, MA boarding school"
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">Common questions</h2>
        <dl className="mt-8 space-y-6 text-sm">
          <FAQ q="Is this really free?">
            Yes. The masterclass is free. After it, you&apos;ll see an offer for our paid Future
            Doctors Fellowship programme — at a reduced rate for attendees only. No obligation.
          </FAQ>
          <FAQ q="Will it be recorded if I can't make it live?">
            Yes — register and we&apos;ll send you the recording. Live attendance unlocks the
            attendee discount, though.
          </FAQ>
          <FAQ q="Who is this for?">
            High-school students (Grades 9-12) considering medicine, their parents, and counsellors
            / pre-med advisors who guide them.
          </FAQ>
          <FAQ q="What's the Future Doctors Fellowship?">
            A 12-week mentor-led programme: 1:1 coaching, interview practice, application support,
            and a doctor-led curriculum. We&apos;ll explain it more in the session.
          </FAQ>
        </dl>
      </section>

      <footer className="border-t border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto max-w-5xl px-6 py-8 text-xs text-neutral-500">
          © Learn with Leaders · A fellowship community across UAE, India, USA, and beyond.
        </div>
      </footer>
    </main>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M2.5 6.5l2.5 2.5 4.5-5.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="text-neutral-700 dark:text-neutral-300">{children}</span>
    </li>
  );
}

function Meta({ icon, label }: { icon: IconName; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon name={icon} size={16} className="text-neutral-500" />
      <span>{label}</span>
    </span>
  );
}

function Pill({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</p>
    </div>
  );
}

function Quote({ text, by }: { text: string; by: string }) {
  return (
    <blockquote className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        &ldquo;{text}&rdquo;
      </p>
      <footer className="mt-3 text-xs text-neutral-500">— {by}</footer>
    </blockquote>
  );
}

function FAQ({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <dt className="font-medium">{q}</dt>
      <dd className="mt-2 text-neutral-600 dark:text-neutral-400">{children}</dd>
    </div>
  );
}
