# Founder Tech Notes
- No microservices in V0.
- Calendar truth stays with Google/Microsoft/Zoho.
- We query current busy time instead of syncing all events locally.
- DB stores bookings + temporary holds to reduce double booking.
- AI is optional; broken AI cannot stop scheduling.
- AI/calendar providers use adapters so switching does not rewrite the product.
- MCP is a doorway for agents, not the database.
- Supabase + Vercel are default, architecture remains portable.
