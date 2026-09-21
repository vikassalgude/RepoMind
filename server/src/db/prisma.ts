// // server/src/db/prisma.ts
// import { PrismaClient } from '@prisma/client';
// import { PrismaPg } from '@prisma/adapter-pg';
// import dotenv from 'dotenv';

// dotenv.config();

// const connectionUrl = process.env.DATABASE_URL;

// if (!connectionUrl) {
//   throw new Error("DATABASE_URL is missing in .env");
// }

// // 1. Initialize the Prisma 7 PostgreSQL Adapter
// const adapter = new PrismaPg({ 
//   connectionString: connectionUrl 
// });

// const globalForPrisma = global as unknown as { prisma: PrismaClient };

// // 2. Pass the adapter into the constructor instead of the raw URL
// export const prisma = globalForPrisma.prisma || new PrismaClient({
//   adapter
// });

// if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
// server/src/db/prisma.ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionUrl = process.env.DATABASE_URL;

if (!connectionUrl) {
  throw new Error("DATABASE_URL is missing in .env");
}

// 1. Initialize the native Postgres Pool (Prisma 7 requirement)
const pool = new Pool({ connectionString: connectionUrl });

// 2. Wrap the pool in the Prisma adapter
const adapter = new PrismaPg(pool);

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// 3. Pass the adapter to the Prisma Client
export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;