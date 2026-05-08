"use client";

import { ProviderSidebar } from "@/components/ProviderSidebar";
import { motion } from "framer-motion";
import { Settings, User, Bell } from "lucide-react";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-200">
      <ProviderSidebar />
      <div className="flex-1 flex flex-col h-full">
        <header className="h-16 border-b border-slate-800/60 bg-slate-950/50 backdrop-blur-xl flex items-center px-8 justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold tracking-tighter text-white">ORVEX</h1>
            <div className="h-4 w-px bg-slate-800" />
            <span className="text-xs text-slate-500 font-medium tracking-wide uppercase">Research Engine</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon"><Bell className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon"><Settings className="w-4 h-4" /></Button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500" />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-12 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900/50 via-slate-950 to-slate-950">
          {children}
        </main>
      </div>
    </div>
  );
}

// Minimal button wrapper for layout
function Button({ children, variant = 'ghost', size = 'default', className = '' }: any) {
  const base = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-slate-900";
  return <button className={`${base} ${className}`}>{children}</button>;
}
