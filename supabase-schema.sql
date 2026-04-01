-- Supabase schema for Dog Game
-- Run this in your Supabase SQL editor to set up the database

-- Custom sprites created/edited in the sprite editor
CREATE TABLE custom_sprites (
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

CREATE INDEX idx_custom_sprites_breed ON custom_sprites(breed_key);
CREATE INDEX idx_custom_sprites_public ON custom_sprites(is_public) WHERE is_public = true;

-- Row Level Security
ALTER TABLE custom_sprites ENABLE ROW LEVEL SECURITY;

-- Anyone can read public sprites
CREATE POLICY "Public sprites are viewable by everyone"
  ON custom_sprites FOR SELECT
  USING (is_public = true);

-- Anyone can insert (anonymous access for now)
CREATE POLICY "Anyone can create sprites"
  ON custom_sprites FOR INSERT
  WITH CHECK (true);

-- Anyone can update their own sprites (matched by author name for now)
CREATE POLICY "Anyone can update sprites"
  ON custom_sprites FOR UPDATE
  USING (true);

-- Anyone can delete their own sprites
CREATE POLICY "Anyone can delete sprites"
  ON custom_sprites FOR DELETE
  USING (true);

-- Persistent worlds
CREATE TABLE worlds (
  room_id TEXT PRIMARY KEY,
  seed INTEGER NOT NULL,
  tile_data BYTEA NOT NULL,
  decorations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Player progress per world
CREATE TABLE players (
  room_id TEXT NOT NULL REFERENCES worlds(room_id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  breed TEXT,
  resources JSONB DEFAULT '{}',
  last_seen TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (room_id, player_name)
);

ALTER TABLE worlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Worlds are viewable by everyone" ON worlds FOR SELECT USING (true);
CREATE POLICY "Anyone can create worlds" ON worlds FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update worlds" ON worlds FOR UPDATE USING (true);

CREATE POLICY "Players are viewable by everyone" ON players FOR SELECT USING (true);
CREATE POLICY "Anyone can create players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update players" ON players FOR UPDATE USING (true);
