import React from 'react';
import Link from 'next/link';

interface NavItem {
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { label: 'Intelligence Feed', href: '/dashboard' },
  { label: 'Competitors', href: '/competitors' },
  { label: 'Signals', href: '/signals' },
  { label: 'Dossiers', href: '/dossiers' },
  { label: 'Watchlists', href: '/watchlists' },
  { label: 'Alerts', href: '/alerts' },
  { label: 'Pipelines', href: '/pipelines' },
  { label: 'Reports', href: '/reports' },
];

export const IntelligenceSidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-[#0a0a0a] border-r border-[#1a1a1a] h-screen flex flex-col text-[#666]">
      <div className="p-8 border-b border-[#1a1a1a]">
        <h1 className="text-white font-bold tracking-widest text-lg">ORVEX</h1>
        <p className="text-[9px] text-[#333] uppercase mt-1 tracking-[0.2em]">Institutional Intelligence</p>
      </div>
      <nav className="flex-1 py-8">
        {navItems.map((item) => (
          <Link 
            key={item.label}
            href={item.href}
            className="flex items-center px-8 py-3 text-sm hover:text-white transition-colors duration-200"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-8 border-t border-[#1a1a1a]">
        <Link href="/settings" className="text-sm hover:text-white">
          Settings
        </Link>
      </div>
    </aside>
  );
};
