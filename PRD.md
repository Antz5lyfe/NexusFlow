# Product Requirement Document (PRD)

## Document Control
*   **Product Name:** NexusFlow Orchestrator (Working Title)
*   **Version:** 1.0
*   **Author:** Founder / Product Management
*   **Target Audience:** Engineering Team / Coding Agents
*   **Status:** Draft / Ready for Implementation

---

## 1. Executive Summary & Product Vision
### 1.1 Problem Statement
ASEAN Small and Medium Enterprises (SMEs) are stuck in "Proof of Concept (PoC) Purgatory." While foundational AI models are commoditized and highly accessible, deploying them at scale across multiple corporate departments remains unfeasible due to:
1.  **Siloed Operations:** Lack of a unified interface to coordinate multi-departmental workflows.
2.  **Unpredictable Costs:** Prohibitive API token consumption and computational overhead at scale.
3.  **Regional Nuances:** Fragmented multi-lingual requirements, local software integrations, and strict local data compliance (e.g., PDPA).

### 1.2 The Solution
**NexusFlow Orchestrator** is an enterprise-grade, multi-tenant **Agentic AI Orchestration Interface** designed specifically for ASEAN SMEs. It allows non-technical business leaders and IT administrators to deploy, manage, and monitor autonomous AI agents across different departments (HR, Sales, Customer Support, Finance) within a single unified workspace. 

The platform features a native **ROI & Cost Optimization Layer** that acts as an intelligent router, minimizing token spend, predicting monthly infrastructure costs, and proving business value dynamically.

---

## 2. Architecture & High-Level System Design
The system follows a modular, decoupled architecture optimized for scalability, asynchronous execution, and cost efficiency.

```
       [ Client Web Interface (Next.js / Tailwind) ]
                            │  ▲
                            ▼  │ (REST / WebSockets)
             [ API Gateway & Auth (FastAPI) ]
                            │
        ┌───────────────────┴───────────────────┐
        ▼                                       ▼
 [ Orchestration Engine ]           [ Cost & Routing Optimizer ]
  ├─ Department Router               ├─ Semantic Cache (Redis)
  ├─ Context/Memory Bridge           ├─ Dynamic Model LLM Router
  └─ Celery Worker Pool              └─ Token Tracker & Analytics
        │                                       │
        └───────────────────┬───────────────────┘
                            ▼
      [ Agent Framework / Connectors (LangGraph/CrewAI) ]
                            │
     ┌──────────────────────┼──────────────────────┐
     ▼                      ▼                      ▼
[ Multi-LLM APIs ]  [ Local Enterprise Systems ] [ Vector Db ]
(OpenAI, Anthropic,   (Xero, HubSpot, WhatsApp)   (Qdrant/Milvus)
 Sea-LLM, Llama)
```

### 2.1 Technology Stack (Recommended)
*   **Frontend:** Next.js (TypeScript), Tailwind CSS, shadcn/ui.
*   **Backend:** FastAPI (Python) for high-performance asynchronous API endpoints.
*   **Agent Framework:** LangGraph or CrewAI (state management across long-running, multi-agent workflows).
*   **Task Queue:** Celery with Redis for asynchronous background tasks.
*   **Caching Layer:** Redis (for Semantic Caching of LLM prompts/responses).
*   **Database:** PostgreSQL (Transactional Data, Cost Logs, User Management) + Qdrant/Milvus (Vector Database for localized RAG knowledge bases).

---

## 3. Core Functional Requirements (FRs)

### 3.1 Core Pillar 1: Multi-Department Agentic Workflow Orchestration
*   **FR-1.1: Multi-Department Workspaces:** The system must support isolated departmental workspaces (e.g., HR, Sales, Support, Finance) managed under a single master corporate account.
*   **FR-1.2: Agent Factory & Deployment:** 
    *   Administrators must be able to provision pre-configured or custom AI agents using localized system prompts.
    *   Agents must support multi-lingual models tailored for ASEAN (e.g., Sea-LLM, Llama fine-tunes for Bahasa Indonesia, Thai, Vietnamese, Tagalog).
*   **FR-1.3: Inter-Agent Communication (The Orchestration Bridge):** 
    *   Agents must be capable of handing off tasks to other departments asynchronously (e.g., *Sales Agent* closes a deal via email -> triggers *Finance Agent* to generate an invoice in Xero -> triggers *Support Agent* to schedule onboarding).
*   **FR-1.4: Human-in-the-Loop (HITL) Triggers:** 
    *   The engine must support state suspension. If an agent performs a high-risk task (e.g., issuing an invoice > $1,000), the system must freeze the execution chain, notify the department head via email/Slack/WhatsApp, and await physical approval before proceeding.

### 3.2 Core Pillar 2: ROI & Cost Optimization Layer
*   **FR-2.1: Dynamic LLM Model Routing:** 
    *   The platform must analyze incoming prompts and route them to the most cost-efficient model capable of handling the complexity.
    *   *Example:* Simple data extraction -> routed to a cheap open-source model (e.g., Llama-3-8B). Complex legal compliance check -> routed to a premium model (e.g., Claude 3.5 Sonnet).
*   **FR-2.2: Semantic Response Caching:** 
    *   Implement a local semantic cache database. If a new prompt matches a historical query within a 95% similarity threshold, return the cached result instead of hitting the LLM vendor API, cutting token costs to $0.
*   **FR-2.3: Token Spend Caps & Guardrails:** 
    *   Allow administrators to set strict daily/weekly/monthly spend budgets at the Org, Department, and individual Agent levels.
    *   Automatically throttle or pause agents that exceed 90% of their allocated budget, alerting the IT manager.

### 3.3 Core Pillar 3: Analytics & ROI Dashboard
*   **FR-3.1: Token & Currency Analytics:** Real-time dashboards visualizing token usage, raw API costs, and total dollars saved via semantic caching and dynamic routing.
*   **FR-3.2: Business Metric Tracking (ROI Engine):** 
    *   Users can input default enterprise baseline metrics (e.g., "An HR ticket takes a human 30 minutes, costed at $15/hr").
    *   The dashboard calculates cumulative "Hours Saved" and "Financial ROI" based on completed agent workflows against the business baseline.

---

## 4. Non-Functional Requirements (NFRs)
*   **NFR-4.1: Security & Compliance:** Data persistence layers must encrypt data at rest (AES-256) and in transit (TLS 1.3). Architect the system to strictly adhere to Singapore's PDPA and Indonesia's PDP Law (data sovereignty options to pin data to AWS/GCP Singapore regions).
*   **NFR-4.2: Latency & Asynchronicity:** Because multi-agent loops can take anywhere from 10 seconds to several minutes, the UI must use WebSockets or Server-Sent Events (SSE) to stream live agent logs, thinking steps, and status metrics without blocking user sessions.
*   **NFR-4.3: Extensibility:** Implement a plug-and-play middleware pattern for external integrations (Webhooks, Zapier, Xero, HubSpot).

---

## 5. System Schema & Data Models (For Coding Agents)

### 5.1 Database Models (PostgreSQL Dialect)

```sql
-- Organization / Tenant Table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    country VARCHAR(50) DEFAULT 'SG', -- Regional scaling tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Department Workspace
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- 'HR', 'Sales', 'Finance'
    monthly_budget_usd NUMERIC(10, 2) DEFAULT 100.00,
    current_spend_usd NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent Profiles
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    role_description TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    default_model VARCHAR(100) DEFAULT 'gpt-4o-mini',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Token & Routing Cost Logs
CREATE TABLE cost_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id),
    department_id UUID REFERENCES departments(id),
    prompt_tokens INT DEFAULT 0,
    completion_tokens INT DEFAULT 0,
    model_used VARCHAR(100) NOT NULL,
    raw_cost_usd NUMERIC(12, 6) NOT NULL,
    routing_strategy VARCHAR(50), -- 'DYNAMIC_ROUTING', 'SEMANTIC_CACHE', 'DEFAULT'
    estimated_savings_usd NUMERIC(12, 6) DEFAULT 0.00,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. Phase 1 MVP Implementation Roadmap (Prompt Guidance for Coding Agents)

To build this product successfully, instruct your coding agent to tackle development in the following incremental modules:

*   **Module 1: Foundation Setup:** Build the multi-tenant database using the schema above, and set up a basic FastAPI backend paired with a Next.js frontend scaffolding using shadcn/ui.
*   **Module 2: The Agentic Engine:** Implement a basic multi-agent chain using LangGraph. Create two sample agents: a *Sales Lead Qualifier Agent* and a *CRM Updater Agent* that pass variables to each other.
*   **Module 3: Cost Optimizer & Router:** Write the middleware function inside FastAPI that intercepts the user prompt, runs a cosine-similarity check against a Redis cache, and evaluates length/complexity to choose between an open-source model or a frontier model.
*   **Module 4: HITL Interface:** Implement a custom state check in the backend workflow that pauses execution, updates a PostgreSQL status to `PENDING_APPROVAL`, and exposes an approval button on the Next.js frontend UI.