import { Queue } from "bullmq";
import {connection} from "../config/redis"

export const ingestionQueue=new Queue('repo-ingestion', { connection })

export async function addRepoToQueue(repoUrl: string, repoId: string) {
  await ingestionQueue.add('process-repo', { repoUrl, repoId }, {
    attempts: 3, 
    backoff: { type: 'exponential', delay: 1000 } 
  });
  console.log(` Job added to queue for repo: ${repoUrl}`);
}