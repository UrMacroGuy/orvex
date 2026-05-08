# ORVEX — CLAUDE.md

## PROJECT OVERVIEW

Orvex is a multi-model AI orchestration platform.

Core functionality:
- User submits one research query
- System queries multiple LLM providers in parallel
- System optionally performs web research
- Outputs:
  - individual model responses
  - synthesized consensus summary
  - disagreement analysis
  - source citations

Goal:
Create an intelligence orchestration layer above frontier AI models.

---

# PRIMARY MVP

The MVP is NOT a full autonomous agent system.

The MVP focuses on:
- multi-model querying
- response aggregation
- intelligence synthesis
- clean UX
- BYOK integrations
- web research

Avoid overengineering.

---

# TECH STACK

## Frontend
- Next.js 15
- TypeScript
- TailwindCSS
- shadcn/ui
- Framer Motion

## Backend
- FastAPI
- Python 3.12+
- asyncio-based architecture

## Database
- PostgreSQL
- pgvector (later)
- Redis caching

## AI Providers
- OpenAI API
- Anthropic API
- Gemini API
- OpenRouter API

## Deployment
- Vercel (frontend)
- Railway or Render (backend)

---

# CORE SYSTEM ARCHITECTURE

User Query
→ Query Router
→ Parallel Model Execution
→ Response Normalization
→ Intelligence Synthesis Engine
→ Final UI Rendering

---

# IMPORTANT ARCHITECTURE RULES

## General
- Always prioritize modular architecture
- Avoid monolithic files
- Keep services isolated
- Use typed interfaces everywhere
- Favor readability over cleverness

---

# FRONTEND RULES

## UI Requirements
- Modern dark UI
- Glassmorphism aesthetic
- Investor-grade design quality
- Minimal clutter
- Responsive layout
- Smooth animations

## Frontend Standards
- TypeScript only
- Functional components only
- No inline styles
- Use reusable UI components
- Keep pages thin
- Move logic into hooks/services

## Folder Structure

src/
  app/
  components/
  features/
  hooks/
  lib/
  services/
  store/
  types/

---

# BACKEND RULES

## Backend Standards
- Async-first architecture
- Service-layer architecture
- Strong request validation
- Structured API responses
- Modular routers
- Proper error handling

## Folder Structure

backend/
  app/
    api/
    core/
    services/
    providers/
    models/
    schemas/
    orchestration/
    utils/

---

# AI PROVIDER RULES

Each provider integration must:
- be isolated
- use common interfaces
- support retries
- support timeout handling
- support streaming later

Never tightly couple provider logic.

---

# SYNTHESIS ENGINE RULES

The synthesis engine is the core differentiator.

Responsibilities:
- detect consensus
- detect disagreements
- deduplicate insights
- merge reasoning logically
- preserve unique perspectives

Never fake consensus.

Always distinguish:
- model opinions
- verified web evidence

---

# TOKEN OPTIMIZATION RULES

IMPORTANT:
- Keep responses concise
- Avoid repeating context
- Never rewrite entire files unnecessarily
- Only modify requested sections
- Avoid excessive explanations
- Focus on implementation

When generating code:
- return production-ready code
- avoid placeholders
- avoid pseudocode unless requested

---

# CODE QUALITY RULES

Always:
- write modular code
- add proper typing
- add meaningful naming
- avoid deeply nested logic
- optimize readability
- minimize duplication

Never:
- create giant files
- mix UI and business logic
- use hardcoded values
- overengineer abstractions

---

# MVP PRIORITIES

Priority order:
1. Stable architecture
2. Good UX
3. Fast performance
4. Clean synthesis
5. Reliability
6. Scalability

Not priorities:
- autonomous AGI
- agent swarms
- complex planning systems
- enterprise abstractions

---

# CURRENT PRODUCT POSITIONING

Orvex is:
- multi-model intelligence engine
- AI orchestration platform
- research synthesis system

Orvex is NOT:
- a chatbot clone
- AGI platform
- generic AI wrapper

---

# DESIGN LANGUAGE

Visual direction:
- futuristic
- premium
- minimal
- high-contrast
- cinematic
- intelligence infrastructure aesthetic

Inspirations:
- Linear
- Vercel
- Raycast
- Stripe
- Perplexity
- Notion AI

---

# DEVELOPMENT WORKFLOW

Preferred workflow:
1. architecture first
2. schema definitions
3. service implementation
4. API layer
5. frontend integration
6. polish/refactor

Always think systemically before coding.

---

# RESPONSE STYLE

When responding:
- be concise
- prioritize implementation
- avoid unnecessary prose
- explain tradeoffs briefly
- focus on production-quality output
