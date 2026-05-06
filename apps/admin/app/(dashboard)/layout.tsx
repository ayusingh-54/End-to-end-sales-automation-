import Link from 'next/link';
import { signOut } from '@/app/login/actions';
import { ActiveNavLink } from './active-nav-link';
import { Icon, type IconName } from '@/components/Icon';

const NAV_OPS: { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/leads', label: 'Leads', icon: 'users' },
  { href: '/schools', label: 'Schools', icon: 'building' },
];

const NAV_CONFIG: { href: string; label: string; icon: IconName }[] = [
  { href: '/campaigns', label: 'Campaigns', icon: 'megaphone' },
  { href: '/programs', label: 'Programs', icon: 'book' },
  { href: '/templates', label: 'Templates', icon: 'mail' },
];

const NAV_SYSTEM: { href: string; label: string; icon: IconName }[] = [
  { href: '/logs', label: 'Logs', icon: 'activity' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr] bg-neutral-50 dark:bg-neutral-950">
      <aside className="flex flex-col border-r border-neutral-200 bg-white px-3 py-6 dark:border-neutral-800 dark:bg-neutral-950">
        <Link
          href="/"
          className="mx-2 flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-emerald-700 text-[11px] font-bold text-white shadow-sm">
            LWL
          </span>
          <span>FDF Pipeline</span>
        </Link>

        <NavGroup label="Operate" items={NAV_OPS} />
        <NavGroup label="Configure" items={NAV_CONFIG} />
        <NavGroup label="System" items={NAV_SYSTEM} />

        <form action={signOut} className="mx-2 mt-auto pt-4">
          <button
            type="submit"
            className="group flex w-full items-center gap-2.5 rounded-md border border-neutral-200 px-3 py-1.5 text-left text-xs text-neutral-600 transition hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
          >
            <Icon name="logout" size={14} />
            <span>Sign out</span>
          </button>
        </form>
      </aside>
      <main className="px-8 py-8">{children}</main>
    </div>
  );
}

function NavGroup({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string; icon: IconName }[];
}) {
  return (
    <div className="mt-6">
      <p className="px-2.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
        {label}
      </p>
      <nav className="mt-1.5 flex flex-col gap-0.5 text-sm">
        {items.map((n) => (
          <ActiveNavLink key={n.href} href={n.href} label={n.label} icon={n.icon} />
        ))}
      </nav>
    </div>
  );
}
