'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/Icon';

export function ActiveNavLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: IconName;
}) {
  const pathname = usePathname();
  const isActive =
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
  return (
    <Link
      href={href}
      className={`group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 transition ${
        isActive
          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
          : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100'
      }`}
    >
      <Icon
        name={icon}
        size={16}
        className={
          isActive
            ? ''
            : 'text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-300'
        }
      />
      <span>{label}</span>
    </Link>
  );
}
