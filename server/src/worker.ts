// import { ingestionWorker } from './workers/ingestionWorker';

// // console.log('Ingestion worker started...');
// import { ingestionWorker } from './workers/ingestionWorker';

// console.log('🚀 Ingestion worker process started');
// console.log('Worker object:', ingestionWorker);

// setInterval(() => {
//     console.log('Worker process is alive...');
// }, 5000);
// server/src/worker.ts
import { ingestionWorker } from './workers/ingestionWorker';
import { initializeQdrant } from './config/qdrant';

async function bootWorker() {
  console.log('Booting worker process...');
  
  // 1. Verify Qdrant vector database is ready before accepting jobs
  await initializeQdrant();

  // 2. Reference the worker to force execution
  console.log(`👷 Worker process actively listening on queue: ${ingestionWorker.name}`);
}

bootWorker();

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught worker exception:', err);
});