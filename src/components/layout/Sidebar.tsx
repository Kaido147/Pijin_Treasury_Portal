'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, ChevronRight } from 'lucide-react';
import { useStellarWallet } from '@/hooks/useStellarWallet';
import { NAV_ITEMS } from '@/core/constants';
import { cn } from '@/core/utils';

interface SidebarProps {
  isOpen: boolean;
}

export function Sidebar({ isOpen }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { disconnect } = useStellarWallet();

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full flex flex-col z-40 transition-all duration-300 bg-navy-900 overflow-hidden',
        isOpen ? 'w-60' : 'w-0',
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/[0.07] min-w-60">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-white/[0.12]">
          <span className="text-white font-extrabold text-base">P</span>
        </div>
        <div>
          <div className="text-white font-bold text-[0.9rem] leading-tight">
            Pijin Treasury
          </div>
          <div className="text-white/35 text-[0.65rem] font-mono">
            Admin Portal
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 min-w-60">
        <div className="text-white/25 text-[0.65rem] font-bold tracking-widest px-3 pb-2 uppercase">
          Navigation
        </div>
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              id={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 no-underline',
                active
                  ? 'bg-white/10'
                  : 'bg-transparent hover:bg-white/5',
              )}
            >
              <Icon
                className={cn(
                  'w-4 h-4 shrink-0',
                  active ? 'text-white' : 'text-white/45',
                )}
              />
              <span
                className={cn(
                  'text-sm whitespace-nowrap',
                  active
                    ? 'text-white font-bold'
                    : 'text-white/55 font-medium',
                )}
              >
                {label}
              </span>
              {active && (
                <ChevronRight className="w-3.5 h-3.5 ml-auto text-white/40" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/[0.07] min-w-60">
        <button
          id="disconnect-wallet-btn"
          onClick={async () => {
            await disconnect();
            router.push('/');
          }}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-150 bg-transparent hover:bg-white/[0.07]"
        >
          <LogOut className="w-4 h-4 text-white/35" />
          <span className="text-white/35 text-sm">Disconnect Wallet</span>
        </button>
        <div className="mt-3 px-3 text-white/20 text-[0.65rem] font-mono">
          © 2026 Pijin Network
        </div>
      </div>
    </aside>
  );
}
