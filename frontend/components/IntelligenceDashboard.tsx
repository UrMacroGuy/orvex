"use client";

import React from "react";
import { IntelligenceFeed } from "@/components/IntelligenceFeed";
import { IntelligenceSidebar } from "@/components/IntelligenceSidebar";

export function IntelligenceDashboard() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#050505] text-slate-200 font-sans">
      <IntelligenceSidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-[#1a1a1a] flex items-center justify-between px-8 bg-[#0a0a0a]/50 backdrop-blur-xl">
          <input
            type="text"
            placeholder="Search signals, competitors, strategic events..."
            className="w-96 bg-[#0f0f0f] border border-[#1a1a1a] rounded px-4 py-1.5 text-sm text-white placeholder-[#333] focus:border-[#333] focus:outline-none transition-all"
          />
          <div className="flex items-center gap-6">
            <span className="text-[10px] text-[#333] font-mono tracking-wider">PIPELINE: ACTIVE</span>
            <span className="text-[10px] text-[#333] font-mono tracking-wider">INGESTION: 1.2k/sec</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <IntelligenceFeed />
        </div>
      </main>

      <aside className="w-80 border-l border-[#1a1a1a] bg-[#0a0a0a]/50 p-6">
        <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-6">Intelligence Context</h3>
        <div className="text-[11px] text-[#444]">
            Select a signal to view detailed strategic analysis.
        </div>
      </aside>
    </div>
  );
}
