'use strict';
/**
 * Resolves failed Prisma migrations on Railway
 * Marks the failed migration as rolled back so migrate deploy can continue
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Resolving failed migrations...');
  try {
    // Mark the failed migration as rolled back
    await prisma.$executeRawUnsafe(`
      UPDATE "_prisma_migrations" 
      SET "rolled_back_at" = NOW()
      WHERE "finished_at" IS NULL 
        AND "rolled_back_at" IS NULL
    `);
    console.log('✅ Failed migrations marked as rolled back');
  } catch (e) {
    console.log('Note:', e.message);
  }
  await prisma.$disconnect();
}

main().catch(console.error);
