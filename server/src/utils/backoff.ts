
export async function withExponentialBackOff<T>(
    operation:()=>Promise<T>,
    maxRetries:number=5,
    baseDelayMs:number=2000
):Promise<T>{
    let attempt=0;
    while(attempt<maxRetries){
        try {
            return await operation();
        } catch (error:any) {
            attempt++;
      
            if (attempt >= maxRetries) {
                throw new Error(`Operation failed after ${maxRetries} attempts. Last error: ${error.message}`);
            }
            const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
             const jitter = Math.random() * 1000;
            const totalDelay = exponentialDelay + jitter;
            console.warn(`[Backoff] Rate limit hit. Retrying attempt ${attempt} in ${(totalDelay / 1000).toFixed(1)}s...`);
            await new Promise(resolve => setTimeout(resolve, totalDelay));
        }
    }
    throw new Error("Unreachable");
}