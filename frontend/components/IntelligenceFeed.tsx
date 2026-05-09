import React from 'react';
import { IntelligenceSignal } from '@/app/workspace-layout';

const severityColors: Record<string, string> = {
  low: 'text-slate-500',
  medium: 'text-yellow-400',
  high: 'text-orange-500',
  critical: 'text-red-500',
};

export const IntelligenceFeed: React.FC = () => {
  // In production, this would be hooked to a query/socket from the FinancialSynthesis backend
  const signals: IntelligenceSignal[] = [
    {
      id: '1',
      ticker: 'MSFT',
      companyName: 'Microsoft Corporation',
      category: 'Strategic Infrastructure',
      severity: 'high',
      confidence: 0.92,
      title: 'Data Center Energy Procurement',
      summary: 'Shift in regional power procurement strategy observed.',
      interpretation: 'Increasing focus on energy independence for AI compute scale.',
      detectedAt: '2026-05-09 14:00'
    },
    {
      id: '2',
      ticker: 'NVDA',
      companyName: 'NVIDIA Corporation',
      category: 'Supply Chain',
      severity: 'critical',
      confidence: 0.88,
      title: 'Foundry Capacity Reallocation',
      summary: 'Internal indicators suggest shifting capacity toward Blackwell architecture.',
      interpretation: 'Accelerating product cycle, potentially impacting supply for current Gen AI models.',
      detectedAt: '2026-05-09 11:30'
    }
  ];

  return (
    <div className="max-w-4xl w-full mx-auto">
      <div className="flex justify-between items-end mb-8">
        <h2 className="text-white text-xl font-bold tracking-wide">Operational Intelligence</h2>
        <span className="text-xs text-[#333] font-mono tracking-wider">LIVE FEED - SECURE CHANNEL</span>
      </div>
      
      {signals.map((signal) => (
        <div key={signal.id} className="group bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-6 mb-4 hover:border-[#2a2a2a] transition-all">
          <div className="flex justify-between mb-4">
            <div>
              <span className="text-white font-semibold">{signal.ticker}</span>
              <span className="mx-2 text-[#333]">|</span>
              <span className="text-xs text-[#666] uppercase">{signal.category}</span>
            </div>
            <div className="text-right">
              <div className={`text-sm font-bold ${severityColors[signal.severity]}`}>
                {signal.severity.toUpperCase()}
              </div>
              <div className="text-[10px] text-[#444] font-mono">CONFIDENCE: {(signal.confidence * 100).toFixed(0)}%</div>
            </div>
          </div>

          <h3 className="text-white font-medium mb-2">{signal.title}</h3>
          <p className="text-[#a1a1a1] text-sm mb-4">{signal.summary}</p>
          
          <div className="bg-[#0f0f0f] border border-[#151515] p-4 rounded text-xs text-[#888] italic border-l-2 border-l-cyan-900">
            {signal.interpretation}
          </div>
          
          <div className="mt-4 pt-4 border-t border-[#1a1a1a] flex justify-between items-center text-[10px] font-mono text-[#333]">
            <span>{signal.detectedAt}</span>
            <button className="hover:text-cyan-500 transition-colors">View Dossier →</button>
          </div>
        </div>
      ))}
    </div>
  );
};
