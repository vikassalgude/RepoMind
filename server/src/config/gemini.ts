import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing in .env");
}

export const aiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const embeddingModel = aiClient.getGenerativeModel({ 
  model: "gemini-embedding-001" 
});

export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
}