export const handleSignalingEvents = (io, socket) => {
    socket.on('webrtc-offer', ({ targetRoom, offer }) => {
        console.log(`📡 Forwarding WebRTC Offer from [${socket.id}] to room: ${targetRoom}`);
        socket.to(targetRoom).emit('webrtc-offer', {
            sdp: offer,
            senderId: socket.id
        });
    });

    socket.on('webrtc-answer', ({ targetRoom, answer }) => {
        console.log(` Forwarding WebRTC Answer from [${socket.id}] to room: ${targetRoom}`);
        socket.to(targetRoom).emit('webrtc-answer', {
            sdp: answer,
            senderId: socket.id
        });
    });

    socket.on('ice-candidate',({targetRoom,candidate})=>{
        if(candidate){
            // Direct candidate delivery to the opposite peer in the room
            socket.to(targetRoom).emit('ice-candidate', candidate);
        }
    });
};