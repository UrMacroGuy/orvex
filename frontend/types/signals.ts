export type SignalType =
  | "hiring"
  | "pricing"
  | "product"
  | "sentiment"
  | "partnership"
  | "expansion"
  | "infrastructure"
  | "narrative";

export type Severity = "low" | "medium" | "high" | "critical";

export interface Evidence {
  source: string;
  type: string;
  content: string;
  detectedAt: string;
}

export interface IntelligenceSignal {
  id: string;

  entity: {
    name: string;
    sector?: string;
    category?: string;
  };

  signalType: SignalType;
  severity: Severity;
  confidence: number;

  title: string;
  summary: string;
  interpretation: string;
  implications?: string[];

  evidence: Evidence[];
  relatedSignals?: string[];

  detectedAt: string;

  generatedBy: {
    pipeline: string;
    engine: string;
  };
}
