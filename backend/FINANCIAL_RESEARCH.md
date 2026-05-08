# Financial Research Orchestration Layer

## Overview

The financial research orchestration system extends Orvex with specialized multi-model investment analysis capabilities. It coordinates analysis across multiple AI models to extract bullish/bearish theses, detect consensus, identify contradictions, and produce comprehensive investment research.

## Architecture

### Core Components

#### 1. Market Research Agent (`market_research_agent.py`)
Extracts structured insights about company fundamentals, sector dynamics, and macroeconomic factors.

**Responsibilities:**
- Parses company analysis from model responses
- Sector-level competitive landscape assessment
- Macro factor identification (interest rates, inflation, etc.)
- Key factors extraction

**Output:** `MarketResearchResult` with structured analyses per model

#### 2. Bullish Thesis Agent (`bullish_agent.py`)
Identifies positive investment signals and growth catalysts.

**Detects:**
- Growth catalysts (new markets, product launches)
- Valuation opportunities (discounts, upside potential)
- Operational excellence (efficiency, innovation)
- Market leadership (competitive moats)

**Output:** `BullishThesis` objects with confidence scores

#### 3. Bearish Thesis Agent (`bearish_agent.py`)
Identifies risks, valuation concerns, and macro threats.

**Detects:**
- Execution risks (management, track record)
- Valuation concerns (expensive, stretched)
- Competitive pressure (disruption, share loss)
- Macro headwinds (recession, regulation)
- Regulatory risks

**Output:** `BearishThesis` objects with confidence scores

#### 4. Consensus Engine (`consensus_engine.py`)
Detects agreement across models on investment theses.

**Features:**
- Multi-provider agreement detection
- Configurable minimum provider threshold
- Confidence scoring based on agreement breadth
- Evidence strength assessment

**Output:** `ConsensusPoint` objects showing model alignment

#### 5. Contradiction Engine (`contradiction_engine.py`)
Identifies disagreements and conflicting assumptions.

**Detects:**
- Valuation disagreements (cheap vs expensive)
- Growth outlook divergence (expansion vs stagnation)
- Management quality assessment conflicts
- Competitive positioning disagreements

**Output:** `Contradiction` objects showing model divergence

#### 6. Financial Orchestration Pipeline (`pipeline.py`)
Coordinates all agents to produce comprehensive investment analysis.

**Flow:**
```
Financial Query
  ↓
Orchestration Pipeline (existing)
  ↓ (parallel model execution)
Market Research Analysis
  ↓ (parallel extraction)
Bullish Thesis Extraction ─┐
Bearish Thesis Extraction ─┼→ Consensus Detection
                           ├→ Contradiction Analysis
                           ↓
                    Investment Scoring
                    Key Questions Generation
                    Research Areas Suggestion
                           ↓
                    FinancialSynthesis
```

### Data Flow

1. **Input:** `FinancialQueryCreate` with ticker, query, selected models, optional focus areas
2. **Stage 1:** Execute query across selected AI models in parallel
3. **Stage 2:** Extract market research, bullish/bearish theses independently
4. **Stage 3:** Detect consensus and contradictions across theses
5. **Stage 4:** Calculate investment score, generate key questions
6. **Output:** `FinancialSynthesis` with complete analysis

## API Endpoints

### Create Financial Research
```
POST /api/v1/financial/research
Content-Type: application/json

{
  "ticker": "AAPL",
  "query": "Is Apple a good investment at current valuations?",
  "selected_models": [
    ["claude", "claude-opus-4-7"],
    ["openai", "gpt-4o"],
    ["gemini", "gemini-2.0-flash"],
    ["perplexity", "sonar"]
  ],
  "include_web_research": true,
  "focus_areas": ["valuation", "growth", "competition"]
}
```

### Get Financial Research Results
```
GET /api/v1/financial/research/{query_id}
```

### Stream Financial Research Events
```
GET /api/v1/financial/research/{query_id}/stream
```

### List Financial Research Queries
```
GET /api/v1/financial/research?cursor=&limit=20
```

## Model Strategy

Each model is optimized for specific analysis types:

### Claude (Anthropic)
- **Strength:** Deep reasoning, nuanced analysis
- **Use:** Bullish/bearish thesis synthesis
- **Prompt:** Asks for structured investment cases with assumptions

### GPT-4 (OpenAI)
- **Strength:** Structured financial reasoning
- **Use:** Financial metrics interpretation
- **Prompt:** Focuses on financial statements and ratios

### Gemini (Google)
- **Strength:** Long context, document processing
- **Use:** Financial filings and earnings call analysis
- **Prompt:** 10-K/10-Q analysis, financial deep dives

### Perplexity (Real-time)
- **Strength:** Live news, current events, web citations
- **Use:** Breaking news, recent catalysts, macro updates
- **Prompt:** "What's the latest news and catalysts for this stock?"

### DeepSeek (Cost-efficient)
- **Strength:** Cheap reasoning
- **Use:** Supplementary analysis, secondary confirmation
- **Prompt:** Quick analysis, fact-checking consensus

## Output Schema

### FinancialSynthesis
```python
{
  "ticker": "AAPL",
  "company": CompanyProfile,
  "bullish_theses": [
    {
      "id": "...",
      "title": "Strong ecosystem",
      "confidence": 0.85,
      "growth_catalysts": ["Services revenue", "Vision Pro"],
      "valuation_opportunities": [],
      "supporting_points": [...],
      "provider_id": "claude",
      "model_id": "claude-opus-4-7"
    }
  ],
  "bearish_theses": [
    {
      "id": "...",
      "title": "China revenue risk",
      "confidence": 0.75,
      "risks": ["Geopolitical"],
      "valuation_concerns": ["Premium valuation"],
      "macro_threats": ["Trade war risk"],
      "supporting_points": [...],
      "provider_id": "perplexity",
      "model_id": "sonar"
    }
  ],
  "consensus_points": [
    {
      "id": "...",
      "point": "Strong ecosystem: competitive advantage",
      "supporting_providers": ["claude", "openai", "gemini"],
      "confidence": 0.87,
      "evidence_strength": "strong"
    }
  ],
  "contradictions": [
    {
      "id": "...",
      "topic": "valuation",
      "positions": {
        "claude": "Fairly valued",
        "openai": "Overvalued"
      },
      "assumption_conflicts": [
        "Growth rate assumptions",
        "Terminal multiple assumptions"
      ],
      "risk_disagreements": [...]
    }
  ],
  "investment_score": 0.35,
  "key_questions": [
    "What is the sustainable competitive advantage?",
    "How vulnerable to macro headwinds?",
    "What could change the investment case?"
  ],
  "next_research_areas": [
    "Management team track record",
    "Detailed financial projections"
  ]
}
```

## Implementation Details

### Deterministic ID Generation
All theses and points use MD5-based deterministic IDs for consistency:
```python
id = hashlib.md5(f"{thesis_name}:{model_id}".encode()).hexdigest()[:16]
```

### Confidence Scoring
- **Bullish/Bearish Theses:** Pre-set based on signal strength (0.7-0.9)
- **Consensus:** Based on provider agreement `confidence = num_providers / total_providers`
- **Investment Score:** Aggregated from bullish vs bearish confidence with consensus boost

### Evidence Strength Assessment
```
>= 0.9: very_strong
>= 0.75: strong
>= 0.6: moderate
< 0.6: weak
```

## Configuration

Financial queries use specialized system prompts optimized for investment analysis:

```python
system_prompt = """You are a professional financial analyst. Provide comprehensive 
investment analysis for {ticker}.

Structure your response to include:
1. Company Analysis: Business model, competitive position, key metrics
2. Sector Analysis: Industry trends, competitive landscape
3. Macro Analysis: Economic factors, interest rates, industry headwinds
4. Bullish Case: Growth catalysts, valuation opportunities, competitive advantages
5. Bearish Case: Risks, valuation concerns, macro threats
6. Investment Thesis: Overall assessment and key takeaways

Be specific, data-driven, and distinguish between facts and opinions."""
```

## Key Design Decisions

### 1. Modular Agents
- Each agent is independent and testable
- Agents don't communicate with each other
- All data flows through orchestration layer
- Easy to add new agents without refactoring

### 2. Deterministic Processing
- No randomization in thesis extraction
- Same input always produces same analysis
- Enables reproducibility and testing
- Deduplication handles model redundancy

### 3. Multi-Model Consensus
- Minimum 2 providers required for consensus (configurable)
- Confidence reflects agreement breadth
- Contradictions highlighted explicitly
- No fake consensus

### 4. Focus Areas (Optional)
- Users can specify research focus
- Filters consensus/contradiction detection
- Narrows analysis scope
- Improves relevance

### 5. Investment Scoring
- Simple mathematical formula
- Bullish - Bearish, scaled by consensus
- Range: -1.0 (bearish) to +1.0 (bullish)
- 0.0 = neutral

## Integration with Existing System

Leverages existing Orvex infrastructure:

- **OrchestrationPipeline:** Executes queries across models
- **ProviderRegistry:** Accesses all AI models
- **KeyService:** Manages API credentials
- **EventBus:** Streams results to client
- **Database:** Persists queries and results

No changes needed to existing providers or core orchestration.

## Error Handling

- Graceful degradation if some models fail
- Analysis proceeds with available responses
- Error messages propagated to user
- Detailed logging for debugging

## Performance

- Market research: ~100ms per model
- Thesis extraction: ~50ms per model
- Consensus detection: ~20ms (all models)
- Contradiction analysis: ~20ms (all models)
- Investment scoring: <1ms

Total pipeline time dominated by model execution (30-120s per model depending on response length).

## Testing

Each agent is independently testable:

```python
from app.financial.market_research_agent import MarketResearchAgent
from app.orchestration.normalizer import NormalizedResponse

agent = MarketResearchAgent()
results = agent.analyze(context)
assert len(results) > 0
assert all(r.provider_id is not None for r in results)
```

## Future Enhancements

1. **Confidence Calibration:** Train scoring based on real market data
2. **Temporal Analysis:** Track thesis changes over time
3. **Sentiment Tracking:** Integrate market sentiment data
4. **Peer Comparison:** Compare analysis across peer companies
5. **Backtesting:** Measure thesis accuracy against stock performance
6. **Custom Agents:** Allow users to define custom analysis templates
7. **Report Generation:** PDF/HTML export with visualizations
