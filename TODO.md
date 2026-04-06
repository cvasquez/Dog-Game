# TODO

Future features and improvements.

## Features

- **Supabase world persistence** — Sync multiplayer world codes and data to Supabase instead of only local SQLite. Requires adding `@supabase/supabase-js` as a server dependency, creating a server-side Supabase client, and writing world data to the `worlds` table alongside SQLite saves. Would enable world discovery and persistence across server restarts.
