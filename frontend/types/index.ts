export interface Query {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
}

export interface ProviderResponse {
  provider: string;
  model: string;
  content: string;
}

export interface SynthesisEvent {
  type: 'response' | 'synthesis' | 'citation' | 'disagreement' | 'complete';
  data: any;
}
