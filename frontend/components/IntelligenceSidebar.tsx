import React from 'react';
import Link from 'next/link';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: 'Intelligence Feed', href: '/dashboard', icon: '📡' },
  { label: 'Competitors', href: '/market', icon: '🎯' },
  { label: 'Signals', href: '/signals', icon: '⚡' },
  { label: 'Market Maps', href: '/maps', icon: '🗺️' },
  { label: 'Dossiers', href: '/financial', icon: '📚' },
  { label: 'Alerts', href: '/alerts', icon: '🔔' },
];

export const IntelligenceSidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-[#0a0a0a] border-r border-[#1a1a1a] h-screen flex flex-col text-[#a1a1a1]">
      <div className="p-6 border-b border-[#1a1a1a]">
        <h1 className="text-white font-bold tracking-wider">ORVEX</h1>
      </div>
      <nav className="flex-1 py-6">
        {navItems.map((item) => (
          <Link 
            key={item.label}
            href={item.href}
            className="flex items-center px-6 py-3 hover:bg-[#151515] hover:text-cyan-400 transition-colors duration-200"
          >
            <span className="mr-3">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-6 border-t border-[#1a1a1a]">
        <Link href="/settings" className="flex items-center text-sm hover:text-white">
          ⚙️ Settings
        </Link>
      </div>
    </aside>
  );
};
