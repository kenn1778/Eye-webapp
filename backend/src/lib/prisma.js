import { PrismaClient } from "../generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "../config.js";

// Prisma 7 requires a driver adapter for every database. The generated client
// is CommonJS, but this module is ESM to match the rest of the backend.
const adapter = new PrismaPg({ connectionString: config.databaseUrl });

// Single shared client - Prisma manages its own connection pool, so creating
// more than one instance per process just wastes connections.
export const prisma = new PrismaClient({ adapter });

// Disconnect is owned by the server's graceful-shutdown routine so it can run
// after the HTTP server has drained and queued jobs have flushed.
export async function disconnectPrisma(signal = "shutdown") {
  try {
    await prisma.$disconnect();
  } catch (error) {
    console.error(`[eye:db] disconnect failed on ${signal}:`, error.message);
  }
}
