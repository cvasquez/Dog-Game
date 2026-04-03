#!/usr/bin/env node
// Seed Supabase with the built-in sprite data from sprite-data.js
// Usage: node scripts/seed-sprites.js

import 'dotenv/config';
import { DOG_SPRITES, SPRITE_PALETTE, ANIM_STATES } from '../shared/sprite-data.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_KEY environment variables are required');
  process.exit(1);
}

async function supabaseRequest(path, method, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase ${method} ${path} failed (${res.status}): ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

const force = process.argv.includes('--force');

async function main() {
  console.log('Seeding sprites to Supabase...');
  console.log(`URL: ${SUPABASE_URL}`);
  console.log(`Breeds: ${Object.keys(DOG_SPRITES).join(', ')}`);
  console.log(`Palette: ${SPRITE_PALETTE.length} entries`);
  if (force) console.log('⚠ --force: existing rows WILL be overwritten');
  console.log();

  for (const breedKey of Object.keys(DOG_SPRITES)) {
    const spriteData = DOG_SPRITES[breedKey];

    // Check if this breed already exists
    const existing = await supabaseRequest(
      `/custom_sprites?breed_key=eq.${breedKey}&name=eq.${encodeURIComponent(breedKey + ' (default)')}&select=id`,
      'GET'
    );

    if (existing && existing.length > 0) {
      if (!force) {
        console.log(`  Skipping ${breedKey} (already exists, use --force to overwrite)`);
        continue;
      }
      const id = existing[0].id;
      console.log(`  Overwriting ${breedKey} (id: ${id})...`);
      await supabaseRequest(
        `/custom_sprites?id=eq.${id}`,
        'PATCH',
        {
          sprite_data: spriteData,
          palette: SPRITE_PALETTE,
          updated_at: new Date().toISOString(),
        }
      );
    } else {
      console.log(`  Inserting ${breedKey}...`);
      await supabaseRequest('/custom_sprites', 'POST', {
        name: `${breedKey} (default)`,
        breed_key: breedKey,
        sprite_data: spriteData,
        palette: SPRITE_PALETTE,
        author: 'system',
        is_public: true,
      });
    }
  }

  console.log();
  console.log('Done! All sprites seeded.');
}

main().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
