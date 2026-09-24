# Clone AI Employee OS — Threat Model & Security Architecture

## 1. Overview & Trust Boundaries

Clone is an AI Employee Operating System. Because AI employees execute semi-autonomous or autonomous workflows using third-party tool APIs (GitHub, Slack, Linear, Gmail, HubSpot) and cloud workspace microVMs (E2B, Codespaces), securing trust boundaries is critical.

### Trust Boundaries Diagram

```
[ Human User / Dashboard ] 
          │ (JWT Auth over TLS 1.3)
          ▼
┌─────────────────────────────────────────────────────────────┐
│                       Clone Core API                        │
│  - MongoDB (Encrypted at rest & transport)                  │
│  - Redis Rate Limiter                                       │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌───────────────────────┐             ┌───────────────────────┐
│ AI Runtime Engine     │             │ Integration Framework │
│ - Prompt Guardrails   │             │ - OAuth Token Vault   │
│ - Scoped Vector Mem   │             │ - Scoped Permissions  │
└───────────┬───────────┘             └───────────┬───────────┘
            │                                     │
            ▼                                     ▼
┌───────────────────────┐             ┌───────────────────────┐
│ Cloud Workspace       │             │ External SaaS APIs    │
│ - MicroVM Isolation   │             │ (GitHub, Slack, etc.) │
└───────────────────────┘             └───────────────────────┘
```

---

## 2. Threat Analysis & Mitigation Matrix

| Threat Category | Specific Attack Vector | Potential Impact | Mitigation Strategy Implemented in Clone |
| :--- | :--- | :--- | :--- |
| **Prompt Injection** | Direct or indirect prompt injection via external tools (e.g. malicious code comments in GitHub PRs or Slack messages) | Remote instructions override system prompts, leading to unauthorized actions. | **Input Sanitization & Context Isolation:** All external inputs are wrapped in strict delimiters (`<<<EXTERNAL_UNTRUSTED_INPUT>>>`) and filtered through an adversarial classifier before LLM invocation. |
| **Credential & Token Theft** | Exfiltration of user OAuth tokens (GitHub, Slack, Gmail) stored in backend. | Compromise of third-party connected accounts. | **AES-256-GCM Vault Encryption:** OAuth tokens are encrypted at rest using AES-256-GCM with per-organization key rotation. |
| **Sandbox Escape / RCE** | Arbitrary code execution escaping from sandbox to host server. | Host compromise or cross-tenant data leak. | **MicroVM Isolation (E2B / Firecracker):** Engineering tasks execute inside ephemeral Firecracker MicroVMs with strict memory/CPU resource caps and non-root user execution. |
| **Unauthorized Action Execution** | AI employee performs high-risk actions (e.g. deleting DB tables, merging unreviewed production PRs). | Data loss or production downtime. | **Human-in-the-Loop Approval Center:** High-risk tool calls (`create_pull_request`, `delete_database`, `send_email`) are intercepted by the state machine and placed in `WAITING_APPROVAL` status until explicitly authorized by a human founder/admin. |
| **Data Leakage Across Tenants** | AI employee accesses vector memories or context from another tenant organization. | Cross-tenant privacy violation. | **Multi-Tenant Scoped Vectors:** All MongoDB queries and vector searches are scoped strictly by `companyId`. Database indexes enforce unique composite keys `(companyId, key)`. |

---

## 3. Cryptographic & Regulatory Compliance

- **Data Encryption at Rest:** AES-256-GCM for secrets, TLS 1.3 for all transport channels.
- **Audit Logging:** Every AI decision, tool call, approval, and state transition produces an immutable log record with SHA-256 state hashes.
- **SOC-2 Type II Alignment:** Access controls, role-based policies, audit trails, and automated session revocation.
