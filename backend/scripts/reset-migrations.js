'use strict';
/**
 * Resolves failed Prisma migrations on Railway
 * Deletes the failed migration record so migrate deploy can re-apply it
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Resolving failed migrations...');
  try {
    // Delete failed migration records so they can be re-applied
    const result = await prisma.$executeRawUnsafe(`
      DELETE FROM "_prisma_migrations" 
      WHERE "finished_at" IS NULL 
        AND "rolled_back_at" IS NULL
    `);
    console.log('✅ Removed', result, 'failed migration(s)');

    // Also delete any migrations that came AFTER the failed one
    // so they re-apply in correct order
    await prisma.$executeRawUnsafe(`
      DELETE FROM "_prisma_migrations"
      WHERE "migration_name" IN (
        '20260417_live_commerce_full',
        '20260417_live_stream_url',
        '20260417_seller_follows',
        '20260418_live_auction_groupbuy',
        '20260418_live_bulk',
        '20260419_social_commerce',
        '20260419_social_posts',
        '20260420_export_marketplace'
      )
    `);
    console.log('✅ Reset dependent migrations for clean re-apply');
  } catch (e) {
    console.log('Migration table note:', e.message);
  }
  await prisma.$disconnect();
}

main().catch(console.error);
