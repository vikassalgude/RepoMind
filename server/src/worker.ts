// import { ingestionWorker } from './workers/ingestionWorker';

// console.log('Ingestion worker started...');
import { ingestionWorker } from './workers/ingestionWorker';

console.log('🚀 Ingestion worker process started');
console.log('Worker object:', ingestionWorker);

setInterval(() => {
    console.log('Worker process is alive...');
}, 5000);