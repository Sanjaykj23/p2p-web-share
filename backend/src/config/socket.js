import { Server } from 'socket.io';


export const initSocket=(httpServer)=>{
    const io=new Server(httpServer,{
        cors:{
            origin:process.env.FRONTEND_URL || "http://localhost:3000",
            method:["GET","POST"]
        }
    });

    io.on('connection',(socket)=>{
        console.log(`🔌 Peer connected to signaling cluster: ${socket.id}`);

        socket.on('disconnect',()=>{
            console.log(` Peer disconnected from network: ${socket.id}`);
        });
    });
    return io;
};
