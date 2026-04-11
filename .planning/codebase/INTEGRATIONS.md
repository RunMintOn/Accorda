# External Integrations

**Analysis Date:** 2026-04-11

## APIs & External Services

**LLM Provider:**
- OpenAI-compatible chat completion endpoint - Used for stage-one text responses in `src/provider/openaiClient.ts`
  - SDK/Client: `openai`
  - Auth: `CONTEXTA_API_KEY`
  - Endpoint selection: `CONTEXTA_BASE_URL`
  - Model selection: `CONTEXTA_MODEL`

**Reference Material:**
- Internal planning docs reference Claude Code UI ideas in `docs/superpowers/plans/2026-04-11-claude-code-tui-visual-parity.md`
  - This is documentation-only context, not a runtime dependency

## Data Storage

**Databases:**
- None

**File Storage:**
- Local filesystem only
  - Append-only JSONL event history in `src/store/eventLogStore.ts`
  - Session metadata JSON in `src/store/sessionMetaStore.ts`

**Caching:**
- None

## Authentication & Identity

**Auth Provider:**
- No end-user identity layer is implemented
  - Current authentication surface is provider API key configuration in `src/core/config.ts`

## Monitoring & Observability

**Error Tracking:**
- None

**Logs:**
- Event history can be persisted to local JSONL through `src/store/eventLogStore.ts`
- No structured application logging or remote telemetry is wired into `src/runtime/defaultRunner.ts`

## CI/CD & Deployment

**Hosting:**
- No hosting target is defined; current app is a local terminal client started by `npm run dev`

**CI Pipeline:**
- None found in the repository root; no GitHub Actions, no pipeline configs, no release workflow files

## Environment Configuration

**Required env vars:**
- `CONTEXTA_BASE_URL`
- `CONTEXTA_API_KEY`
- `CONTEXTA_MODEL`

**Secrets location:**
- Expected from process environment at runtime via `src/core/config.ts`
- No checked-in `.env` template or secret loader was found

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- HTTPS API requests to the configured OpenAI-compatible endpoint from `src/provider/openaiClient.ts`

---

*Integration audit: 2026-04-11*
