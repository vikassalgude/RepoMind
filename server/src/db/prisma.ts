// server/src/db/prisma.ts
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const connectionUrl = process.env.DATABASE_URL;

if (!connectionUrl) {
  throw new Error("DATABASE_URL is missing in .env");
}

// Prevent multiple instances in development which crashes the DB connection limit
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Pass the URL directly into the constructor (Prisma 7 standard)
export const prisma = globalForPrisma.prisma || new PrismaClient({
  datasourceUrl: connectionUrl
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;