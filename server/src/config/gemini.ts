// server/src/config/gemini.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing in .env");
}

// 1. Initialize the Google Gen AI SDK
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 2. Select the model. text-embedding-004 outputs exactly 768 dimensions.
// export const embeddingModel = genAI.getGenerativeModel({ 
//   model: "text-embedding-004" 
// });

export const embeddingModel = genAI.getGenerativeModel({ 
  model: "gemini-embedding-001" 
});


// 3. Export a clean helper function for the worker pipeline
export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
}