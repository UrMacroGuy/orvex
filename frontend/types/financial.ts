export type ResearchType = 'stock' | 'earnings' | 'macro' | 'sector' | 'company' | 'crypto' | 'thematic' | 'market';
export type TimeHorizon = 'intraday' | 'short_term' | 'medium_term' | 'long_term';

export interface ModelSelection {
  provider_id: 'orvex' | 'openai' | 'anthropic' | 'gemini' | 'openrouter';
  model_id: string;
}

export interface FinancialQuery {
  query: string;
  selected_models: ModelSelection[];
  research_type: ResearchType;
  ticker?: string;
  company_name?: string;
  time_horizon?: TimeHorizon;
  web_research?: boolean;
}

export interface ModelResponseOut {
  id: string;
  query_id: string;
  provider_id: string;
  model_id: string;
  status: string;
  text?: string;
  latency_ms?: number;
  usage?: { input_tokens: number; output_tokens: number };
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface SynthesisOut {
  id: string;
  query_id: string;
  summary: string;
  consensus: Array<{
    id: string;
    claim: string;
    supporting_models: string[];
    confidence: number;
  }>;
  disagreements: Array<{
    id: string;
    topic: string;
    positions: Array<{ provider_id: string; model_id: string; position: string }>;
  }>;
  unique_insights: Array<{
    id: string;
    insight: string;
    provider_id: string;
    model_id: string;
  }>;
  citations: Array<{
    id: string;
    url: string;
    title: string;
    snippet?: string;
    claim_ids: string[];
  }>;
  created_at: string;
  updated_at: string;
}

export interface BullishThesis {
  id: string;
  title: string;
  confidence: number;
  supporting_points: string[];
  growth_catalysts: string[];
  valuation_opportunities: string[];
  provider_id: string;
  model_id: string;
}

export interface BearishThesis {
  id: string;
  title: string;
  confidence: number;
  supporting_points: string[];
  risks: string[];
  valuation_concerns: string[];
  macro_threats: string[];
  provider_id: string;
  model_id: string;
}

export interface ConsensusPoint {
  id: string;
  point: string;
  supporting_providers: string[];
  confidence: number;
  evidence_strength: string;
}

export interface Contradiction {
  id: string;
  topic: string;
  positions: Record<string, string>;
  assumption_conflicts: string[];
  risk_disagreements: string[];
}

export interface StreamEvent {
  type:
    | 'query_started'
    | 'model_started'
    | 'model_delta'
    | 'model_completed'
    | 'model_failed'
    | 'synthesis_started'
    | 'synthesis_ready'
    | 'done'
    | 'error';
  query_id: string;
  provider_id?: string;
  model_id?: string;
  delta?: string;
  latency_ms?: number;
  response?: ModelResponseOut;
  synthesis?: SynthesisOut;
  financial_synthesis?: FinancialSynthesis;
  error?: { code: string; message: string };
}

export interface FinancialSynthesis {
  ticker?: string;
  direct_answer?: string;
  company_or_theme_context: string[];
  summary: string;
  consensus: SynthesisOut['consensus'];
  disagreements: SynthesisOut['disagreements'];
  unique_insights: SynthesisOut['unique_insights'];
  citations: SynthesisOut['citations'];
  confidence_score: {
    consensus_agreement: number;
    bullish_confidence: number;
    bearish_confidence: number;
  };
  investment_thesis: string;
  key_risks: string[];
  market_sentiment: string[];
  macro_impact: string[];
  key_catalysts: string[];
  ai_consensus?: string;
  bullish_theses: BullishThesis[];
  bearish_theses: BearishThesis[];
  consensus_points: ConsensusPoint[];
  contradictions: Contradiction[];
  investment_score: number;
  confidence_detail?: {
    score: number;
    explanation: string;
  };
  key_questions: string[];
  next_research_areas: string[];
}

export interface StockData {
  ticker: string;
  price: number;
  change_percent: number;
  market_cap?: string;
  pe_ratio?: number;
  dividend_yield?: number;
  fifty_two_week_high?: number;
  fifty_two_week_low?: number;
  avg_volume?: string;
}

export interface MarketSnapshot {
  indices: Array<{
    symbol: string;
    name: string;
    price: number;
    change_percent: number;
  }>;
  top_gainers: Array<{
    ticker: string;
    company_name: string;
    price: number;
    change_percent: number;
    volume?: string;
  }>;
  top_losers: Array<{
    ticker: string;
    company_name: string;
    price: number;
    change_percent: number;
    volume?: string;
  }>;
  sector_performance: Array<{
    sector: string;
    change_percent: number;
    top_performer?: string;
  }>;
}
