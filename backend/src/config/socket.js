import { Server } from 'socket.io';
import { handleRoomEvents } from '../socket/roomHandler.js';
import { handleSignalingEvents } from '../socket/signalHandler.js';

export const initSocket=(httpServer)=>{
    const io=new Server(httpServer,{
        cors:{
            origin:process.env.FRONTEND_URL || "http://localhost:3000",
            methods:["GET","POST"]
        }
    });

    io.on('connection',(socket)=>{
        console.log(`[Socket] Peer connected to signaling cluster: ${socket.id}`);

        // Register room management and signaling event handlers
        handleRoomEvents(io, socket);
        handleSignalingEvents(io, socket);

        socket.on('disconnect',()=>{
            console.log(`[Socket] Peer disconnected from network: ${socket.id}`);
        });
    });
    return io;
};

