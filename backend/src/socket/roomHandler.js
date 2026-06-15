export const handleRoomEvents = (io, socket) => {
    socket.on('join-room', (roomId) => {
        const clientsInRoom = io.sockets.adapter.rooms.get(roomId);
        const numClients = clientsInRoom ? clientsInRoom.size : 0;
        if (numClients === 0) {
            socket.join(roomId);
            console.log(`[Room] Peer [${socket.id}] created and joined room: ${roomId}`);
            socket.emit('room-created', roomId);
        }
        else if (numClients === 1) {
            socket.join(roomId);
            console.log(`[Room] Peer [${socket.id}] joined existing room: ${roomId}`);
            socket.to(roomId).emit('peer-joined', { peerId: socket.id });
        } else {
            console.log(`[Warning] Peer [${socket.id}] rejected. Room ${roomId} is full.`);
            socket.emit('room-full', roomId);
        }
    });
};