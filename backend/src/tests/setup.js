'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  // Clean all test data from previous runs before starting
  await prisma.user.deleteMany({ where: { email: { contains: '@test.hafa' } } }).catch(() => {});
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: '@test.hafa' } } }).catch(() => {});
  await prisma.$disconnect();
});

global.testPrisma = prisma;
