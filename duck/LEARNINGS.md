# TheDuck Project Learnings
1. **Separate differentiator from reliability primitive.** AI differentiates; calendar booking must remain reliable.
2. **An integration wishlist is not automatically a V0 feature list.** Preserve adapters, then require a concrete JTBD for non-critical mail/MCP work.
3. **Provider support is an evidence claim.** Adapter code is not “supported” until live E2E evidence exists.
4. **Latent-product UX needs an escape hatch.** Direct booking prevents AI from feeling like friction.
5. **Modular monolith + ports/adapters is a strong vibe-coding default.** Controls scope while retaining vendor portability.
6. **Separate "definitely not applied" from "outcome unknown".** For calendar writes this distinction drives all compensation. A retry changes what "definite" means: after an ambiguous attempt, even a hard error can't prove the event is absent.
7. **One lifecycle table beats holds + bookings tables.** A single exclusion constraint over all slot-occupying states is the whole double-booking guarantee, and it is testable with 20 concurrent connections.
8. **Exercise the real boundaries early.** Running the built app in a browser found bugs unit tests could not: a `24:00` value an `<input type=time>` can't hold, phone-width overflow, and empty env lines. Running against a real Postgres made race claims evidence instead of hope.
9. **Deterministic provider IDs make retries free.** A client-chosen Google event ID turns "did the insert happen?" into "insert again and read the 409".
10. **Run concurrency tests many times.** The race test passed several times before a run exposed a real Postgres deadlock between exclusion-constraint inserts. One green run of a race test is not evidence; 80 is.
