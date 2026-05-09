import React from 'react';
import { useIntelligenceStore } from '@/store/useIntelligenceStore';

const severityColors: Record<string, string> = {
  low: 'text-slate-500',
  medium: 'text-yellow-400',
  high: 'text-orange-500',
  critical: 'text-red-500',
};

export const IntelligenceFeed: React.FC = () => {
  const { signals } = useIntelligenceStore();

  return (
    <div className="max-w-4xl w-full mx-auto">
      <div className="flex justify-between items-end mb-8">
        <h2 className="text-white text-xl font-bold tracking-wide">Live Intelligence Signals</h2>
        <span className="text-xs text-[#333] font-mono tracking-wider">SECURE MONITORING ACTIVE</span>
      </div>
      
      {signals.length === 0 && (
        <div className="text-[#333] text-sm text-center py-20">Monitoring systems active. Waiting for signal ingestion...</div>
      )}

      {signals.map((signal) => (
        <div key={signal.id} className="group bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-6 mb-4 hover:border-[#2a2a2a] transition-all">
          <div className="flex justify-between mb-4">
            <div>
              <span className="text-white font-semibold">{signal.entity.name}</span>
              <span className="mx-2 text-[#333]">|</span>
              <span className="text-xs text-[#666] uppercase">{signal.signalType}</span>
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
            <button className="hover:text-cyan-500 transition-colors">View Deep Intelligence →</button>
          </div>
        </div>
      ))}
    </div>
  );
};
