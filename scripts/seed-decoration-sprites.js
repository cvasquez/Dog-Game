#!/usr/bin/env node
// Seed Supabase with the built-in decoration sprite data from sprite-data.js
// Usage: node scripts/seed-decoration-sprites.js

import { DECORATION_SPRITES, DECORATION_PALETTES } from '../shared/sprite-data.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qwvmbmjanuyinlqzmymt.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_TL41nSN0-SyAvpd3xgHUlw_N7fRqQIO';

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

async function main() {
  console.log('Seeding decoration sprites to Supabase...');
  console.log(`URL: ${SUPABASE_URL}`);
  console.log(`Decorations: ${Object.keys(DECORATION_SPRITES).join(', ')}`);
  console.log();

  for (const [id, pixels] of Object.entries(DECORATION_SPRITES)) {
    const decId = parseInt(id);
    const palette = DECORATION_PALETTES[id] || [null];

    // Check if this decoration already exists
    const existing = await supabaseRequest(
      `/decoration_sprites?dec_id=eq.${decId}&select=dec_id`,
      'GET'
    );

    if (existing && existing.length > 0) {
      console.log(`  Updating decoration ${decId}...`);
      await supabaseRequest(
        `/decoration_sprites?dec_id=eq.${decId}`,
        'PATCH',
        {
          pixels,
          palette,
          updated_at: new Date().toISOString(),
        }
      );
    } else {
      console.log(`  Inserting decoration ${decId}...`);
      await supabaseRequest('/decoration_sprites', 'POST', {
        dec_id: decId,
        pixels,
        palette,
      });
    }
  }

  console.log();
  console.log('Done! All decoration sprites seeded.');
}

main().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
