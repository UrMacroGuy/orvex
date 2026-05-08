
# Entity Resolution & Routing Logic Design

## Overview
The Entity Resolution (ER) engine acts as the gatekeeper, transforming natural language user queries into structured "Retrieval Plans."

## Workflow
1. **Query Normalization:** Clean and interpret user input.
2. **Intent Extraction:** Identify core intent (Trading, Research, Macro, Sentiment).
3. **Entity Resolution:** Resolve ambiguous names (e.g., "HDFC") to canonical identifiers (e.g., "HDFCBANK.NS").
4. **Retrieval Planning:** Map the resolved entities and intent to specific providers (e.g., Yahoo for quotes, SEC for filings).
5. **Dispatch:** Execute retrieval in parallel using the registered provider instances.

## Data Structures
- `Entity`: {id: str, type: 'ticker' | 'sector' | 'country' | 'macro', confidence: float}
- `RetrievalPlan`: {intent: str, entities: list[Entity], timeFrame: str, requiredSources: list[str]}

## Provider Routing Schema
Each provider implementation will register the data types it can satisfy:
- `yahoo`: quote, earnings, news
- `sec`: filings, risk_factors
- `fred`: macro_data
- `rss`: news

The `Orchestrator` uses this to filter which providers to invoke for a given `RetrievalPlan`.
