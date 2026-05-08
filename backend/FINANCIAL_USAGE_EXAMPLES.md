# Financial Research Orchestration - Usage Examples

## Quick Start

### 1. Create a Financial Research Query

**Request:**
```bash
curl -X POST http://localhost:8000/api/v1/financial/research \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "NVDA",
    "query": "Is NVIDIA overvalued at current levels? What are the key risks and opportunities?",
    "selected_models": [
      ["claude", "claude-opus-4-7"],
      ["openai", "gpt-4o"],
      ["gemini", "gemini-2.0-flash"],
      ["perplexity", "sonar"],
      ["deepseek", "deepseek-chat"]
    ],
    "include_web_research": true,
    "focus_areas": ["valuation", "competition", "macro"]
  }'
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "user_id": "user_uuid",
    "ticker": "NVDA",
    "query": "Is NVIDIA overvalued...",
    "selected_models": [
      ["claude", "claude-opus-4-7"],
      ["openai", "gpt-4o"],
      ...
    ],
    "status": "pending",
    "error": null,
    "completed_at": null,
    "created_at": "2026-05-07T...",
    "updated_at": "2026-05-07T..."
  }
}
```

### 2. Stream Analysis Results

**Request:**
```bash
curl -N -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/v1/financial/research/{query_id}/stream
```

**Events:** (Server-Sent Events)
```
event: query_started
data: {"query_id": "...", "type": "query_started"}

event: model_started
data: {"query_id": "...", "provider_id": "claude", "model_id": "claude-opus-4-7"}

event: model_completed
data: {"query_id": "...", "response": {...}}

event: synthesis_started
data: {"query_id": "...", "type": "synthesis_started"}

event: synthesis_ready
data: {"query_id": "...", "synthesis": {...}}

event: done
data: {"query_id": "...", "type": "done"}
```

### 3. Retrieve Full Results

**Request:**
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/v1/financial/research/{query_id}
```

**Response:**
```json
{
  "data": {
    "query": { /* FinancialQueryOut */ },
    "synthesis": {
      "ticker": "NVDA",
      "company": {
        "ticker": "NVDA",
        "name": "NVIDIA",
        "sector": "Information Technology",
        ...
      },
      "bullish_theses": [
        {
          "id": "a1b2c3d4",
          "title": "AI Chip Leadership",
          "confidence": 0.92,
          "sentiment": "bullish",
          "supporting_points": [
            "Market-leading GPU technology",
            "Strong CUDA ecosystem moat"
          ],
          "growth_catalysts": [
            "Expanding AI workloads",
            "New GPU architectures"
          ],
          "valuation_opportunities": [
            "Margin expansion potential"
          ],
          "provider_id": "claude",
          "model_id": "claude-opus-4-7"
        }
      ],
      "bearish_theses": [
        {
          "id": "x1y2z3w4",
          "title": "Valuation Risk",
          "confidence": 0.78,
          "sentiment": "bearish",
          "supporting_points": [
            "Premium valuation multiple",
            "High growth expectations"
          ],
          "risks": [
            "Execution risk on new products",
            "Competition from AMD/Intel"
          ],
          "valuation_concerns": [
            "P/E ratio elevated",
            "Market cap concentration"
          ],
          "macro_threats": [
            "Potential chip export restrictions",
            "Geopolitical tensions"
          ],
          "provider_id": "openai",
          "model_id": "gpt-4o"
        }
      ],
      "consensus_points": [
        {
          "id": "cons123",
          "point": "ai_dominance: market leader",
          "supporting_providers": ["claude", "openai", "gemini", "perplexity"],
          "confidence": 0.89,
          "evidence_strength": "very_strong"
        },
        {
          "id": "cons456",
          "point": "valuation: elevated",
          "supporting_providers": ["openai", "deepseek"],
          "confidence": 0.65,
          "evidence_strength": "moderate"
        }
      ],
      "contradictions": [
        {
          "id": "contra789",
          "topic": "valuation",
          "positions": {
            "claude": "Attractive at these levels",
            "openai": "Expensive valuation",
            "gemini": "Fair value with growth"
          },
          "assumption_conflicts": [
            "Long-term AI TAM assumptions",
            "Terminal growth rate expectations",
            "Competitive moat durability"
          ],
          "risk_disagreements": [
            "Competition intensity assessment",
            "Regulatory risk evaluation"
          ]
        }
      ],
      "investment_score": 0.42,
      "key_questions": [
        "Is the AI TAM as large as markets are pricing in?",
        "How long can NVIDIA maintain its competitive advantage?",
        "What are the regulatory risks around chip export?"
      ],
      "next_research_areas": [
        "Detailed competitive analysis vs AMD/Intel",
        "Supply chain risk assessment",
        "Long-term TAM projections"
      ]
    },
    "research_depth": "standard",
    "analysis_timestamp": "2026-05-07T..."
  }
}
```

### 4. List Previous Research

**Request:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8000/api/v1/financial/research?limit=10"
```

**Response:**
```json
{
  "data": {
    "items": [
      { /* FinancialQueryOut */ },
      { /* FinancialQueryOut */ }
    ],
    "next_cursor": "2026-05-07T10:30:00"
  }
}
```

## Use Cases

### Use Case 1: Due Diligence Research

Analyze a potential acquisition target with multi-model consensus.

```json
{
  "ticker": "ACME",
  "query": "Comprehensive investment analysis of ACME Corp. What are the key investment strengths, weaknesses, and valuation implications?",
  "selected_models": [
    ["claude", "claude-opus-4-7"],
    ["openai", "gpt-4o"],
    ["gemini", "gemini-2.0-flash"]
  ],
  "include_web_research": true,
  "focus_areas": ["valuation", "growth", "management", "competition"]
}
```

**Analysis Focus:** High consensus areas indicate confidence; contradictions signal areas needing deeper investigation.

### Use Case 2: Contrarian Opportunity Finding

Use contradictions to identify where market consensus might be wrong.

```json
{
  "ticker": "VALUE_TRAP_CANDIDATE",
  "query": "Are there overlooked opportunities in this deeply undervalued stock? What do bulls and bears miss?",
  "selected_models": [
    ["claude", "claude-opus-4-7"],
    ["perplexity", "sonar"],
    ["deepseek", "deepseek-chat"]
  ],
  "include_web_research": true,
  "focus_areas": ["valuation", "growth_catalysts"]
}
```

**Analysis Focus:** Look for strong bearish consensus conflicting with emerging bullish catalysts in contradictions.

### Use Case 3: Sector Analysis

Compare multiple companies in same sector.

```json
{
  "ticker": "TECH_SECTOR_OVERVIEW",
  "query": "How do the key tech companies stack up against each other? Which offers the best risk/reward?",
  "selected_models": [
    ["claude", "claude-opus-4-7"],
    ["openai", "gpt-4o"],
    ["gemini", "gemini-2.0-flash"],
    ["perplexity", "sonar"]
  ],
  "include_web_research": true,
  "focus_areas": ["competition", "valuation", "growth"]
}
```

**Analysis Focus:** Consensus on sector tailwinds, contradictions on competitive positioning.

### Use Case 4: News Event Analysis

Quickly assess implications of breaking news.

```json
{
  "ticker": "COMPANY",
  "query": "What are the investment implications of the recent antitrust announcement? How does this change the bull/bear cases?",
  "selected_models": [
    ["perplexity", "sonar"],
    ["claude", "claude-opus-4-7"],
    ["openai", "gpt-4o"]
  ],
  "include_web_research": true,
  "focus_areas": ["regulatory_risk", "valuation"]
}
```

**Analysis Focus:** Use Perplexity for latest news context, other models for implications.

### Use Case 5: Thesis Validation

Test an investment thesis against multi-model analysis.

```json
{
  "ticker": "GROWTH_STOCK",
  "query": "Is the long-term growth thesis for this company compelling? What are the biggest risks to the bull case?",
  "selected_models": [
    ["claude", "claude-opus-4-7"],
    ["gemini", "gemini-2.0-flash"],
    ["deepseek", "deepseek-chat"]
  ],
  "include_web_research": false,
  "focus_areas": ["growth", "macro", "competition"]
}
```

**Analysis Focus:** Strong consensus on growth catalysts validates thesis; contradictions reveal assumptions being challenged.

## Interpreting Results

### Investment Score Guide

```
  1.0: Very Bullish - Strong consensus, minimal risks
  0.5: Moderately Bullish - Clear opportunities, manageable risks
  0.0: Neutral - Balanced bull/bear cases
 -0.5: Moderately Bearish - Clear risks, limited upside
 -1.0: Very Bearish - Strong consensus on downside
```

### Confidence Interpretation

```
>= 0.9: Very High Confidence (multiple strong signals)
>= 0.75: High Confidence (clear evidence)
>= 0.6: Moderate Confidence (some evidence)
< 0.6: Low Confidence (nascent signals)
```

### Evidence Strength Guide

```
very_strong: Multiple models strongly agree (90%+ consensus)
strong: Clear agreement across providers (75%+)
moderate: Some agreement (60-75%)
weak: Nascent or minority viewpoint (<60%)
```

### Using Contradictions

High-quality contradictions reveal:
1. **Assumption Conflicts:** Different economic assumptions
2. **Risk Disagreements:** Divergent risk assessments
3. **Evidence Gaps:** Areas needing deeper research

Use these to:
- Identify your own biases
- Find research gaps
- Stress-test investment theses
- Discover alternative scenarios

## Model-Specific Strengths

### When Claude Says Bullish
- Nuanced long-term thinking
- Sustainable competitive advantages identified
- Quality of management assessed
- **Weight Highly:** Thesis quality and sustainability

### When Perplexity Says Bullish
- Recent positive news/catalysts
- Market momentum signals
- Current sentiment positive
- **Weight Moderately:** May miss medium-term risks

### When OpenAI Says Bullish
- Financial metrics support thesis
- Quantitative signals aligned
- Valuation justified by growth
- **Weight Highly:** Analytical rigor

### When Gemini Says Bullish
- Deep document analysis supports
- Filing details support thesis
- Management quality evident
- **Weight Highly:** Document research depth

### When DeepSeek Disagrees
- Often identifies overlooked angles
- Cost efficiency perspectives unique
- Early signal of contrarian views
- **Weight Moderately:** Emerging signals worth investigating

## Advanced Usage

### Monitoring Over Time

Create recurring research jobs to track thesis evolution:

```python
# Schedule monthly re-analysis
recurring_query = {
  "ticker": "LONG_TERM_HOLDING",
  "query": "Quarterly thesis update: Is our long-term investment case still valid?",
  "selected_models": [
    ["claude", "claude-opus-4-7"],
    ["openai", "gpt-4o"]
  ],
  "include_web_research": true
}
```

### Building Investment Frameworks

Use FinancialSynthesis to feed structured decision models:

```python
def investment_decision(synthesis: FinancialSynthesis) -> str:
    if synthesis.investment_score > 0.5:
        if len(synthesis.contradictions) > 3:
            return "BUY - Strong consensus, consider risks from contradictions"
        return "STRONG_BUY"
    elif synthesis.investment_score < -0.5:
        if any(c.confidence > 0.85 for c in synthesis.consensus_points):
            return "AVOID"
        return "SELL"
    else:
        return "HOLD"
```

### Custom Filtering

Extract specific signals:

```python
# Find consensus on growth
growth_consensus = [
    c for c in synthesis.consensus_points 
    if "growth" in c.point.lower() and c.confidence > 0.8
]

# Find high-confidence bearish theses
high_confidence_risks = [
    t for t in synthesis.bearish_theses 
    if t.confidence > 0.85
]

# Find major disagreements
major_disagreements = [
    c for c in synthesis.contradictions 
    if len(c.positions) > 2
]
```

## Performance Tips

1. **Narrow Focus Areas:** Speeds up consensus/contradiction detection
2. **Fewer Models:** Reduces execution time (5-10 models optimal)
3. **Cache API Keys:** Pre-validate provider keys
4. **Batch Queries:** Queue multiple analyses
5. **Monitor Tokens:** Track token usage per model

## Troubleshooting

### "No consensus points found"
- Models may have divergent views (see contradictions)
- Focus areas too narrow
- Try removing focus_areas parameter

### "Investment score neutral (0.0)"
- Perfectly balanced bull/bear cases
- Normal for mature, fairly-valued companies
- Check contradictions for nuance

### "High contradiction count"
- Unusual if same models analyzed
- Check for API key issues
- Verify model selections

### "Missing synthesis"
- Analysis still in progress (check stream endpoint)
- Some models may have failed
- Check error field in query response

## Related Topics

- See `FINANCIAL_RESEARCH.md` for architecture details
- See `backend/app/financial/` for implementation
- See `backend/app/schemas/financial.py` for data models
