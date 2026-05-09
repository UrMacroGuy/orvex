"use client";

import React, { useState } from 'react';
import { IntelligenceSidebar } from "@/components/IntelligenceSidebar";
import { Bell, Search } from "lucide-react";

// Types for the intelligence platform
export type SignalSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface IntelligenceSignal {
  id: string;
  ticker: string;
  companyName: string;
  category: string;
  severity: SignalSeverity;
  confidence: number;
  title: string;
  summary: string;
  interpretation: string;
  detectedAt: string;
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a] text-[#a1a1a1]">
      <IntelligenceSidebar />
      <div className="flex-1 flex flex-col h-full bg-[#050505]">
        <header className="h-16 border-b border-[#1a1a1a] flex items-center px-8 justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-white">
              <Search className="w-4 h-4" />
              <input 
                type="text" 
                placeholder="Global Intelligence Search..." 
                className="bg-transparent border-none outline-none text-sm w-64 placeholder-[#333]" 
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-[#151515] rounded-md transition-colors">
              <Bell className="w-4 h-4" />
            </button>
            <div className="w-8 h-8 rounded-full bg-cyan-900 border border-cyan-800" />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-12">
          {children}
        </main>
      </div>
    </div>
  );
}
