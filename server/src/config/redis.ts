import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();
if(!process.env.REDIS_URL){
    throw new Error("REDIS_URL is missing in .env");
}
export const connection=new Redis(process.env.REDIS_URL,{
    maxRetriesPerRequest:null
})
connection.on('connect',()=>{
    console.log("Connected to UpStash Redis")
})
connection.on('error',()=>{
    console.error("Connection to UpStash Redis failed ")
})
