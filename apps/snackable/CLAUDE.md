<!-- Created by Claude (claude-opus-5-5) -->
<!-- Date: 2026-10-21 -->

# Snackable

## Supabase

Shared data design: [plan 0002](docs/plans/0002-snackable-shared-data.md). Schema: [tools/schema.sql](tools/schema.sql). Every caller goes through the Data API: `js/sharedStore.js` (`supabase-js`, anon key plus anonymous sign-in), `tools/curate.mjs --push` (REST, service key) and `.github/workflows/snackable-keepalive.yml` (REST, anon key).

### Tables need explicit grants

Reference: [Breaking Change: Tables Not Exposed to Data and GraphQL API Automatically](https://github.com/orgs/supabase/discussions/45329) (Supabase changelog, 2026-04-28).

New tables in `public` get no privileges for `anon`, `authenticated` or `service_role`. This is the default for projects created after 2026-05-30 and applies to every existing project from 2026-10-30. Existing tables keep the grants they have. A table without a grant returns `42501 permission denied` before RLS runs, whatever created it (SQL editor, migration, CLI, MCP, agent). `service_role` skips RLS and still needs grants.

Grants each caller needs, all of which `tools/schema.sql` must state:

| Object | `anon` | `authenticated` | `service_role` |
|---|---|---|---|
| `games` | `select` (keep-awake workflow) | `select` (`connect()`) | `select, insert, update` (`curate.mjs --push` upserts with `merge-duplicates`) |
| `reports`, `likes` | none | `select, insert, delete` (`sync()`, `setReported()`, `setLiked()`; the `ignoreDuplicates` upsert needs only `insert`) | none |
| `game_stats` view | `select` | `select` | none |

Rules for schema changes:

- Put the `grant` statements in the same script as `enable row level security` and the policies. Grants decide whether a role reaches a table; RLS decides which rows it sees.
- Anonymous sign-in players use the `authenticated` role.
- A new client write path needs its privilege added here and in the schema: an upsert with `merge-duplicates` needs `update` as well as `insert`.
- Sequences and functions do not inherit table grants. A `serial` or `identity` column needs `grant usage, select on sequence ... to <role>` for inserts. The schema uses text and composite keys, so it has none today.
- Views need their own grant. `game_stats` runs as its owner (`security_invoker = false`) on purpose to count every player's rows. Any other view granted to `anon` or `authenticated` uses `security_invoker = on`.
- `pg_graphql` is off by default for new projects. Snackable does not use GraphQL.
- Do not rely on the CLI `auto_expose_new_tables` key; Supabase removes it on 2026-10-30.
- After a schema change, check the Data API exposure badge in the Table Editor and the Security Advisor, then run the app, `curate.mjs --push` and the keep-awake workflow once.
