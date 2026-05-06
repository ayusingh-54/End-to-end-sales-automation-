import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <p className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
        404
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        The page you’re looking for doesn’t exist or has moved. Try one of these instead:
      </p>
      <ul className="mt-6 grid grid-cols-2 gap-2 text-sm">
        <NavCard href="/" title="Home" />
        <NavCard href="/dashboard" title="Dashboard" />
        <NavCard href="/leads" title="Leads" />
        <NavCard href="/schools" title="Schools" />
        <NavCard href="/campaigns" title="Campaigns" />
        <NavCard href="/logs" title="Pipeline events" />
      </ul>
    </main>
  );
}

function NavCard({ href, title }: { href: string; title: string }) {
  return (
    <li>
      <Link
        href={href}
        className="block rounded-lg border border-neutral-200 px-3 py-2 text-left transition hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
      >
        {title}
      </Link>
    </li>
  );
}
