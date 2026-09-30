import { ingestionWorker } from './workers/ingestionWorker';
import { initializeQdrant } from './config/qdrant';

async function bootWorker() {
  console.log('Booting worker process...');
  await initializeQdrant();
  console.log(`👷 Worker process actively listening on queue: ${ingestionWorker.name}`);
}

bootWorker();

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught worker exception:', err);
});