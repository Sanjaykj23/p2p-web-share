import express from 'express';
import {createServer} from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { initSocket } from './config/socket.js';
import { corsOptions } from './config/cors.js';


dotenv.config();

const app=express();
const PORT=process.env.PORT || 5000;


app.get('/health',(req,res)=>{
    res.status(200).json({ status: 'Signaling server operational' });
});

app.use(cors(corsOptions));

const httpServer=createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => {
    console.log(`[Server] Signaling infrastructure running safely on port ${PORT}`);
});