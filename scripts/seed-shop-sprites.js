#!/usr/bin/env node
// Seed Supabase with the built-in shop machine sprite data from sprite-data.js
// Usage: node scripts/seed-shop-sprites.js

import 'dotenv/config';
import { SHOP_SPRITES, SHOP_PALETTES } from '../shared/sprite-data.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
// Prefer service role key (bypasses RLS) over anon key
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_KEY) environment variables are required');
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
  console.log('Seeding shop sprites to Supabase...');
  console.log(`URL: ${SUPABASE_URL}`);
  console.log(`Shop types: ${Object.keys(SHOP_SPRITES).join(', ')}`);
  if (force) console.log('⚠ --force: existing rows WILL be overwritten');
  console.log();

  for (const [shopType, pixels] of Object.entries(SHOP_SPRITES)) {
    const palette = SHOP_PALETTES[shopType] || [null];

    // Check if this shop sprite already exists
    const existing = await supabaseRequest(
      `/shop_sprites?shop_type=eq.${shopType}&select=shop_type`,
      'GET'
    );

    if (existing && existing.length > 0) {
      if (!force) {
        console.log(`  Skipping ${shopType} (already exists, use --force to overwrite)`);
        continue;
      }
      console.log(`  Overwriting ${shopType}...`);
      await supabaseRequest(
        `/shop_sprites?shop_type=eq.${shopType}`,
        'PATCH',
        {
          pixels,
          palette,
          updated_at: new Date().toISOString(),
        }
      );
    } else {
      console.log(`  Inserting ${shopType}...`);
      await supabaseRequest('/shop_sprites', 'POST', {
        shop_type: shopType,
        pixels,
        palette,
      });
    }
  }

  console.log();
  console.log('Done! All shop sprites seeded.');
}

main().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
