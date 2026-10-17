# MCP integration surface
MCP is interoperability, not the booking database.

Planned server tools: `find_availability`, `create_booking`, `reschedule_booking`, `cancel_booking`, `get_booking`.

A host may optionally connect a remote MCP server. Discovered tools are mapped into capability names and allowlisted. Never execute arbitrary discovered tools merely because a model asks.

At bootstrap, official MCP docs identify the v2 stable packages `@modelcontextprotocol/server` and `@modelcontextprotocol/client`; re-verify before implementation.
