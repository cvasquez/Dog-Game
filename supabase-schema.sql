-- Supabase schema for Dog Game
-- Run this in your Supabase SQL editor to set up the database
-- Safe to re-run: uses IF NOT EXISTS and DROP POLICY IF EXISTS throughout
--
-- IMPORTANT: After creating the first admin user in Supabase Auth,
-- grant them the admin role:
--   UPDATE auth.users
--   SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
--   WHERE email = 'your@email.com';

-- Custom sprites created/edited in the sprite editor
CREATE TABLE IF NOT EXISTS custom_sprites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  breed_key TEXT NOT NULL,
  sprite_data JSONB NOT NULL,      -- { idle: [["0000...","0000...",...], ...], walk: [...], ... }
  palette JSONB NOT NULL,          -- array of palette entries matching SPRITE_PALETTE format
  author TEXT DEFAULT 'anonymous',
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_sprites_breed ON custom_sprites(breed_key);
CREATE INDEX IF NOT EXISTS idx_custom_sprites_public ON custom_sprites(is_public) WHERE is_public = true;

ALTER TABLE custom_sprites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public sprites are viewable by everyone" ON custom_sprites;
DROP POLICY IF EXISTS "Anyone can create sprites" ON custom_sprites;
DROP POLICY IF EXISTS "Anyone can update sprites" ON custom_sprites;
DROP POLICY IF EXISTS "Anyone can delete sprites" ON custom_sprites;
DROP POLICY IF EXISTS "Admins can create sprites" ON custom_sprites;
DROP POLICY IF EXISTS "Admins can update sprites" ON custom_sprites;
DROP POLICY IF EXISTS "Admins can delete sprites" ON custom_sprites;

CREATE POLICY "Public sprites are viewable by everyone"
  ON custom_sprites FOR SELECT
  USING (is_public = true);

CREATE POLICY "Admins can create sprites"
  ON custom_sprites FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

CREATE POLICY "Admins can update sprites"
  ON custom_sprites FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

CREATE POLICY "Admins can delete sprites"
  ON custom_sprites FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- Decoration sprites edited in the sprite editor
CREATE TABLE IF NOT EXISTS decoration_sprites (
  dec_id INTEGER PRIMARY KEY,
  pixels JSONB NOT NULL,            -- array of hex-string rows (e.g. ["0000011100...", ...])
  palette JSONB NOT NULL,           -- array of color strings (index 0 = null/transparent)
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE decoration_sprites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Decoration sprites are viewable by everyone" ON decoration_sprites;
DROP POLICY IF EXISTS "Anyone can create decoration sprites" ON decoration_sprites;
DROP POLICY IF EXISTS "Anyone can update decoration sprites" ON decoration_sprites;
DROP POLICY IF EXISTS "Admins can create decoration sprites" ON decoration_sprites;
DROP POLICY IF EXISTS "Admins can update decoration sprites" ON decoration_sprites;

CREATE POLICY "Decoration sprites are viewable by everyone"
  ON decoration_sprites FOR SELECT
  USING (true);

CREATE POLICY "Admins can create decoration sprites"
  ON decoration_sprites FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

CREATE POLICY "Admins can update decoration sprites"
  ON decoration_sprites FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- Shop machine sprites edited in the sprite editor
CREATE TABLE IF NOT EXISTS shop_sprites (
  shop_type TEXT PRIMARY KEY,         -- 'decorations', 'emotes', 'upgrades', 'stash'
  pixels JSONB NOT NULL,              -- array of hex-string rows (32 chars each for 32px wide)
  palette JSONB NOT NULL,             -- array of color strings (index 0 = null/transparent)
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE shop_sprites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop sprites are viewable by everyone" ON shop_sprites;
DROP POLICY IF EXISTS "Anyone can create shop sprites" ON shop_sprites;
DROP POLICY IF EXISTS "Anyone can update shop sprites" ON shop_sprites;
DROP POLICY IF EXISTS "Admins can create shop sprites" ON shop_sprites;
DROP POLICY IF EXISTS "Admins can update shop sprites" ON shop_sprites;

CREATE POLICY "Shop sprites are viewable by everyone"
  ON shop_sprites FOR SELECT
  USING (true);

CREATE POLICY "Admins can create shop sprites"
  ON shop_sprites FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

CREATE POLICY "Admins can update shop sprites"
  ON shop_sprites FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- Persistent worlds
CREATE TABLE IF NOT EXISTS worlds (
  room_id TEXT PRIMARY KEY,
  seed INTEGER NOT NULL,
  tile_data BYTEA NOT NULL,
  decorations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Player progress per world
CREATE TABLE IF NOT EXISTS players (
  room_id TEXT NOT NULL REFERENCES worlds(room_id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  breed TEXT,
  resources JSONB DEFAULT '{}',
  last_seen TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (room_id, player_name)
);

ALTER TABLE worlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Worlds are viewable by everyone" ON worlds;
DROP POLICY IF EXISTS "Anyone can create worlds" ON worlds;
DROP POLICY IF EXISTS "Anyone can update worlds" ON worlds;
DROP POLICY IF EXISTS "Admins can create worlds" ON worlds;
DROP POLICY IF EXISTS "Admins can update worlds" ON worlds;

DROP POLICY IF EXISTS "Players are viewable by everyone" ON players;
DROP POLICY IF EXISTS "Anyone can create players" ON players;
DROP POLICY IF EXISTS "Anyone can update players" ON players;
DROP POLICY IF EXISTS "Admins can create players" ON players;
DROP POLICY IF EXISTS "Admins can update players" ON players;

CREATE POLICY "Worlds are viewable by everyone" ON worlds FOR SELECT USING (true);
CREATE POLICY "Admins can create worlds" ON worlds FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND (auth.jwt()->'app_metadata'->>'role') = 'admin');
CREATE POLICY "Admins can update worlds" ON worlds FOR UPDATE
  USING (auth.role() = 'authenticated' AND (auth.jwt()->'app_metadata'->>'role') = 'admin');

CREATE POLICY "Players are viewable by everyone" ON players FOR SELECT USING (true);
CREATE POLICY "Admins can create players" ON players FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND (auth.jwt()->'app_metadata'->>'role') = 'admin');
CREATE POLICY "Admins can update players" ON players FOR UPDATE
  USING (auth.role() = 'authenticated' AND (auth.jwt()->'app_metadata'->>'role') = 'admin');
