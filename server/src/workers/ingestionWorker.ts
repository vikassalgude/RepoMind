import { Worker,Job } from "bullmq";
import { connection } from "../config/redis";
import { prisma } from "../db/prisma";
import axios from "axios";

// block binary files and lockfiles to avoid redundant data in db
const isProcessableFile=(filePath:string):boolean=>{
  const ignoredExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.mp4', '.zip', '.pdf', '.woff', '.ttf'];
  const ignoredFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
  const hasIgnoredExtension = ignoredExtensions.some(ext => filePath.endsWith(ext));
  const isIgnoredFile = ignoredFiles.some(file => filePath.endsWith(file));
  return !hasIgnoredExtension && !isIgnoredFile;
}

export const ingestionWorker=new Worker('repo-ingestion',async(job:Job)=>{
    const {repoUrl,repoId}=job.data;
    try {
        await prisma.repository.update({
        where: { id: repoId },
        data: { status: 'INDEXING' }
        });
        const match=repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!match) throw new Error("Invalid GitHub URL format");
        const owner = match[1];
        const repo = match[2].replace('.git', '');

        const repoDetails=await axios.get(`https://api.github.com/repos/${owner}/${repo}`);
        const defaultBranch=repoDetails.data.default_branch
        console.log(` Fetching file tree for branch: ${defaultBranch}...`);

        const treeResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`);
        if (!treeResponse.data.tree) {
            throw new Error("GitHub API returned an invalid or truncated file tree.");
        }
        
        // 5. Filter for actual code files
        const files = treeResponse.data.tree
        .filter((node: any) => node.type === 'blob') // 'blob' means file
        .map((node: any) => node.path)
        .filter(isProcessableFile);
          console.log(` Found ${files.length} processable code files.`);

        // ready for processing 
        await prisma.repository.update({
        where: { id: repoId },
        data: { status: 'READY' }
        });

        console.log(` Successfully processed repository: ${repoUrl}`);
    } catch (error:any) {
        console.error(` Failed to process ${repoUrl}:`, error.message);
    
        // Mark as FAILED in the database on error
        await prisma.repository.update({
        where: { id: repoId },
        data: { status: 'FAILED' }
        });
        
        throw error;
    }
},{ connection })

ingestionWorker.on('completed', job => console.log(` Job ${job.id} completed.`));
ingestionWorker.on('failed', (job, err) => console.error(` Job ${job?.id} failed:`, err.message));
ingestionWorker.on('error', (err) => {
  console.error(" Worker error:", err);
});