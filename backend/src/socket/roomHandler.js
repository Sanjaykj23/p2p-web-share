export const handleRoomEvents=(io,socket)=>{
    socket.on('join-room',(roomId)=>{
        const clientsInRoom=io.sockets.adapter.rooms.get(roomId);
        const numClients=clientsInRoom?clientsInRoom:0;
        if(numClients==0){
            socket.join(roomId);
            console.log(`🏠 Peer [${socket.id}] created and joined room: ${roomId}`);
            socket.emit(`room-created`,roomId);
        }
        else if(numClients==1){
            socket.join(roomId);
            console.log(`🤝 Peer [${socket.id}] joined existing room: ${roomId}`);
            socket.to(roomId).emit('peeer-joined',{ peerId: socket.id });
        }else{
            console.log(`⚠️ Peer [${socket.id}] rejected. Room ${roomId} is full.`);
            socket.emit('room-full',roomId);
        }
    });
};