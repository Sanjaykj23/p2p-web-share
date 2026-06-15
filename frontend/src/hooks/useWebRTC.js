import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const CHUNK_SIZE = 16384; // 16 KB chunks for safe buffer management
const BUFFER_THRESHOLD = 65536; // 64 KB threshold for draining buffer

export const useWebRTC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [roomState, setRoomState] = useState('idle'); // 'idle' | 'waiting' | 'connected' | 'full'
  const [roomId, setRoomId] = useState('');
  const roomIdRef = useRef('');

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);
  
  // File Transfer State
  const [progress, setProgress] = useState(0);
  const [transferSpeed, setTransferSpeed] = useState(0); // in MB/s
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [transferDone, setTransferDone] = useState(false);
  const [error, setError] = useState('');

  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const channelRef = useRef(null);
  const receivedChunksRef = useRef([]);
  const receivedBytesRef = useRef(0);
  const transferStartTimeRef = useRef(0);

  // STUN servers configuration for NAT traversal
  const pcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  };

  // Reset transfer state
  const resetTransferState = () => {
    setProgress(0);
    setTransferSpeed(0);
    setFileName('');
    setFileSize(0);
    setIsSending(false);
    setIsReceiving(false);
    setTransferDone(false);
    setError('');
    receivedChunksRef.current = [];
    receivedBytesRef.current = 0;
  };

  // Setup Peer Connection
  const createPeerConnection = (targetRoom) => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection(pcConfig);
    pcRef.current = pc;

    // Send local ICE candidates to opposite peer
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          targetRoom,
          candidate: event.candidate,
        });
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] PeerConnection state changed: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        setRoomState('connected');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setRoomState('waiting');
        cleanupPeerConnection();
      }
    };

    return pc;
  };

  // Cleanup WebRTC connection
  const cleanupPeerConnection = () => {
    if (channelRef.current) {
      channelRef.current.close();
      channelRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
  };

  // Handle incoming data channel messages (Receiver side)
  const setupDataChannelListeners = (channel) => {
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      console.log('[WebRTC] Data Channel is open and operational');
      setRoomState('connected');
    };

    channel.onclose = () => {
      console.log('[WebRTC] Data Channel closed');
    };

    channel.onerror = (err) => {
      console.error('[WebRTC] Data Channel error:', err);
      setError('Data channel encountered an error.');
    };

    let incomingFileName = '';
    let incomingFileSize = 0;

    channel.onmessage = (event) => {
      const data = event.data;

      // Handle control signals (Metadata and EOF) sent as strings
      if (typeof data === 'string') {
        try {
          const signal = JSON.parse(data);
          if (signal.type === 'metadata') {
            resetTransferState();
            setIsReceiving(true);
            incomingFileName = signal.name;
            incomingFileSize = signal.size;
            setFileName(signal.name);
            setFileSize(signal.size);
            transferStartTimeRef.current = Date.now();
          } else if (signal.type === 'eof') {
            // Reconstruct the file from chunks
            const blob = new Blob(receivedChunksRef.current);
            const downloadUrl = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = incomingFileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(downloadUrl);
            
            setIsReceiving(false);
            setTransferDone(true);
          }
        } catch (err) {
          console.error('Failed to parse text signal:', err);
        }
        return;
      }

      // Handle binary chunks
      if (data instanceof ArrayBuffer) {
        receivedChunksRef.current.push(data);
        receivedBytesRef.current += data.byteLength;

        // Calculate progress percentage
        const progressPercent = Math.min(
          Math.round((receivedBytesRef.current / incomingFileSize) * 100),
          100
        );
        setProgress(progressPercent);

        // Calculate speed (MB/s)
        const timeElapsed = (Date.now() - transferStartTimeRef.current) / 1000; // seconds
        if (timeElapsed > 0) {
          const speed = (receivedBytesRef.current / (1024 * 1024)) / timeElapsed; // MB/s
          setTransferSpeed(parseFloat(speed.toFixed(2)));
        }
      }
    };
  };

  // Connect to the socket signaling cluster
  useEffect(() => {
    const socket = io(BACKEND_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Server] Connected to signaling server');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[Server] Disconnected from signaling server');
      setIsConnected(false);
      setRoomState('idle');
      cleanupPeerConnection();
    });

    // Server acknowledges room creation
    socket.on('room-created', (room) => {
      console.log(`[Room] Created room: ${room}`);
      setRoomState('waiting');
      setRoomId(room);
    });

    // Server acknowledges peer connection to room
    socket.on('room-full', (room) => {
      console.log(`[Warning] Room ${room} is full`);
      setRoomState('full');
      setError('The room you are trying to join is already full (maximum 2 peers).');
    });

    // A peer joined our room (Initiate WebRTC Offer - Sender role)
    socket.on('peer-joined', async ({ peerId }) => {
      console.log(`[Room] Peer [${peerId}] joined. Setting up WebRTC connection...`);
      setRoomState('connected');

      const pc = createPeerConnection(roomIdRef.current);
      
      // Create data channel
      const channel = pc.createDataChannel('fileShareChannel', {
        ordered: true,
      });
      channelRef.current = channel;
      setupDataChannelListeners(channel);

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc-offer', {
          targetRoom: roomIdRef.current,
          offer: pc.localDescription,
        });
      } catch (err) {
        console.error('Failed to create WebRTC offer:', err);
        setError('Failed to initialize WebRTC handshake.');
      }
    });

    // Received WebRTC Offer (Receiver role)
    socket.on('webrtc-offer', async ({ sdp, senderId }) => {
      console.log(`[WebRTC] Received offer from [${senderId}]`);
      const pc = createPeerConnection(roomIdRef.current);

      // Listen for data channel created by sender
      pc.ondatachannel = (event) => {
        const channel = event.channel;
        channelRef.current = channel;
        setupDataChannelListeners(channel);
      };

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', {
          targetRoom: roomIdRef.current,
          answer: pc.localDescription,
        });
      } catch (err) {
        console.error('Failed to handle WebRTC offer:', err);
        setError('Failed to reply to WebRTC connection offer.');
      }
    });

    // Received WebRTC Answer
    socket.on('webrtc-answer', async ({ sdp, senderId }) => {
      console.log(`[WebRTC] Received answer from [${senderId}]`);
      if (pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        } catch (err) {
          console.error('Failed to set remote description from answer:', err);
          setError('Failed to finalize WebRTC handshake.');
        }
      }
    });

    // Received ICE Candidate
    socket.on('ice-candidate', async (candidate) => {
      if (pcRef.current && candidate) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding received ICE candidate:', err);
        }
      }
    });

    return () => {
      socket.disconnect();
      cleanupPeerConnection();
    };
  }, []);

  // Join Room Function
  const joinRoom = (id) => {
    if (!id.trim()) return;
    resetTransferState();
    setRoomId(id);
    if (socketRef.current) {
      socketRef.current.emit('join-room', id);
    }
  };

  // Send File Function
  const sendFile = (file) => {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== 'open') {
      setError('Connection is not ready for file transfer.');
      return;
    }

    resetTransferState();
    setIsSending(true);
    setFileName(file.name);
    setFileSize(file.size);
    transferStartTimeRef.current = Date.now();

    // 1. Send file metadata
    channel.send(
      JSON.stringify({
        type: 'metadata',
        name: file.name,
        size: file.size,
      })
    );

    // 2. Read and stream file in chunks
    let offset = 0;
    const reader = new FileReader();

    const sendChunk = () => {
      // Avoid buffer congestion on RTCPeerConnection by monitoring bufferedAmount
      if (channel.bufferedAmount > BUFFER_THRESHOLD) {
        channel.onbufferedamountlow = () => {
          channel.onbufferedamountlow = null;
          sendChunk();
        };
        return;
      }

      if (offset >= file.size) {
        // All chunks sent successfully. Notify receiver.
        channel.send(JSON.stringify({ type: 'eof' }));
        setIsSending(false);
        setTransferDone(true);
        return;
      }

      const chunk = file.slice(offset, offset + CHUNK_SIZE);
      reader.readAsArrayBuffer(chunk);
    };

    reader.onload = (e) => {
      const buffer = e.target.result;
      channel.send(buffer);
      offset += buffer.byteLength;

      // Update progress
      const progressPercent = Math.min(Math.round((offset / file.size) * 100), 100);
      setProgress(progressPercent);

      // Update speed
      const timeElapsed = (Date.now() - transferStartTimeRef.current) / 1000;
      if (timeElapsed > 0) {
        const speed = (offset / (1024 * 1024)) / timeElapsed;
        setTransferSpeed(parseFloat(speed.toFixed(2)));
      }

      sendChunk();
    };

    reader.onerror = (err) => {
      console.error('File reading error:', err);
      setError('Failed to read the selected file.');
      setIsSending(false);
    };

    sendChunk();
  };

  return {
    isConnected,
    roomState,
    roomId,
    progress,
    transferSpeed,
    fileName,
    fileSize,
    isSending,
    isReceiving,
    transferDone,
    error,
    joinRoom,
    sendFile,
    resetTransferState,
  };
};
