-- CP-M2-2 (HUMAN decision): the host chooses their public slug during first-time setup.
-- New hosts are created without a slug; the dashboard asks for one (suggested from the Google display name).
-- A host without a slug has no public page. The unique index still guarantees one host per slug (NULLs don't collide).
-- Existing hosts keep their current slug. V0: no later slug editing, history or redirects.
alter table hosts alter column slug drop not null;
