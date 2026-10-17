# Architecture Decision Log
## ADR-001 — Modular monolith
Next.js + Postgres, no microservices. Reason: fastest deploy/debug; adapters preserve boundaries. Provenance: THEDUCK-SUGGESTED + HUMAN-APPROVED.

## ADR-002 — AI outside critical path
Direct booking never requires AI. Reason: reliability. Provenance: IMPLEMENTATION-NECESSARY.

## ADR-003 — Live free/busy before sync
Reason: eliminate webhook/sync complexity until data proves need. Provenance: THEDUCK-SUGGESTED.

## ADR-004 — Capability adapters
Google/Microsoft/Zoho/MCP behind shared interfaces. Reason: user requested switching/integrations. Provenance: HUMAN.

## ADR-005 — MCP not source of truth
MCP tools call application services. Reason: authorization/consistency stays inside product. Provenance: IMPLEMENTATION-NECESSARY.
