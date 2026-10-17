# TheDuck Coding-Agent Contract

Read `docs/PRODUCT_INTENT_LOCKED_V1.md` first. It is authoritative.

## Core rule
Challenge before lock. Protect after lock.

Before changing code: identify milestone, read locked intent, state intended change, classify provenance, and stop for a Change Proposal if product intent would change.

During implementation: remain on JTBD path, prefer smallest proof, separate facts from assumptions, keep canonical artifacts portable, and keep provider adapters from becoming sources of truth.

Evidence states: `VERIFIED`, `IMPLEMENTED NOT VERIFIED`, `ASSUMPTION`, `OPEN QUESTION`, `FAILED`.

Assume the session may end unexpectedly. Keep `duck/HANDOFF.md` usable by another coding agent.
