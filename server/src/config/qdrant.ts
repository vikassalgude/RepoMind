// server/src/config/qdrant.ts
import { QdrantClient } from "@qdrant/js-client-rest";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.QDRANT_URL || !process.env.QDRANT_API_KEY) {
  throw new Error("QDRANT_URL or QDRANT_API_KEY is missing in .env");
}

export const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

export const COLLECTION_NAME = "repomind_chunks";

// Enforce vector dimension alignment before processing any jobs
export async function initializeQdrant(): Promise<void> {
  try {
    const result = await qdrantClient.collectionExists(COLLECTION_NAME);
    
    if (!result.exists) {
      console.log(`[Qdrant] Creating new vector collection: ${COLLECTION_NAME}...`);
      await qdrantClient.createCollection(COLLECTION_NAME, {
        vectors: {
          size: 768, // Exactly matches gemini-embedding-001 output dimension
          distance: "Cosine",
        },
      });
      console.log(`[Qdrant] Collection successfully provisioned.`);
    } else {
      console.log(`[Qdrant] Collection '${COLLECTION_NAME}' is ready.`);
    }
  } catch (error) {
    console.error("❌ Failed to initialize Qdrant:", error);
    throw error;
  }
}