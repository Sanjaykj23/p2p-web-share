import { useState, useEffect } from 'react';
import { useWebRTC } from './hooks/useWebRTC';
import DropZone from './components/DropZone';
import PogressBar from './components/PogressBar';
import './App.css';

function App() {
  const {
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
    resetTransferState
  } = useWebRTC();

  const [inputRoomId, setInputRoomId] = useState('');
  const [copied, setCopied] = useState(false);

  // Sync with URL Hash on Mount and Hash Change
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#room-')) {
        const id = hash.replace('#room-', '');
        joinRoom(id);
      }
    };

    // Run on mount
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const createRoom = () => {
    const id = Math.random().toString(36).substring(2, 9);
    window.location.hash = `room-${id}`;
  };

  const handleManualJoin = (e) => {
    e.preventDefault();
    if (inputRoomId.trim()) {
      window.location.hash = `room-${inputRoomId.trim()}`;
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const leaveRoom = () => {
    window.location.hash = '';
    setInputRoomId('');
    window.location.reload(); // Quick reset
  };

  // Helper to get descriptive connection badge
  const renderConnectionBadge = () => {
    if (!isConnected) {
      return (
        <span className="badge badge-disconnected">
          <span className="badge-dot" /> Offline (Connecting to server...)
        </span>
      );
    }
    return (
      <span className="badge badge-connected">
        <span className="badge-dot" /> Server Online
      </span>
    );
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-container">
          <div className="logo-glowing-circle" />
          <h1 className="logo-text">P2P Share</h1>
        </div>
        <div className="connection-status">
          {renderConnectionBadge()}
        </div>
      </header>

      <main className="app-main">
        {error && (
          <div className="error-banner">
            <span className="error-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </span>
            <span className="error-message">{error}</span>
            <button className="error-close" onClick={resetTransferState}>&times;</button>
          </div>
        )}

        {/* State 1: Idle (No room entered yet) */}
        {roomState === 'idle' && (
          <section className="dashboard-card hero-section animate-fade-in">
            <h2>Instant browser-to-browser sharing</h2>
            <p className="hero-subtitle">
              Direct, private, and secure file transfers. No size limits, no server uploads.
            </p>

            <div className="action-row">
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={createRoom}
                disabled={!isConnected}
              >
                Create Share Room
              </button>

              <div className="divider-or">
                <span>or</span>
              </div>

              <form onSubmit={handleManualJoin} className="join-form">
                <input
                  type="text"
                  placeholder="Enter Room Code"
                  value={inputRoomId}
                  onChange={(e) => setInputRoomId(e.target.value)}
                  className="input-code"
                  disabled={!isConnected}
                />
                <button 
                  type="submit" 
                  className="btn btn-secondary"
                  disabled={!isConnected || !inputRoomId.trim()}
                >
                  Join
                </button>
              </form>
            </div>
          </section>
        )}

        {/* State 2: Waiting for Peer */}
        {roomState === 'waiting' && (
          <section className="dashboard-card waiting-section animate-fade-in">
            <h2>Share this room code</h2>
            <p className="room-instructions">
              Send this code to the receiving device. Once they enter it, a secure direct connection will be established.
            </p>

            <div className="share-link-box">
              <span className="share-url" style={{ fontSize: '24px', letterSpacing: '2px', fontWeight: 'bold' }}>{roomId}</span>
              <button 
                type="button" 
                className={`btn btn-copy ${copied ? 'copied' : ''}`}
                onClick={copyRoomCode}
              >
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
            </div>

            <div className="waiting-status">
              <div className="spinner" />
              <p className="waiting-text">Waiting for a peer to join...</p>
            </div>

            <button 
              type="button" 
              className="btn btn-danger"
              onClick={leaveRoom}
            >
              Cancel & Leave
            </button>
          </section>
        )}

        {/* State 3: Connected & Active */}
        {roomState === 'connected' && (
          <section className="dashboard-card connected-section animate-fade-in">
            <div className="connected-header">
              <div className="peer-badge">
                <span className="pulse-dot green" /> Securely Linked to Peer
              </div>
              <button 
                type="button" 
                className="btn-leave-text"
                onClick={leaveRoom}
              >
                Disconnect
              </button>
            </div>

            {/* Substate 3.1: Ready to Share */}
            {!isSending && !isReceiving && !transferDone && (
              <div className="transfer-ready animate-fade-in">
                <h2>Ready to Transfer</h2>
                <p className="transfer-hint">Select a file below to start sharing directly.</p>
                <DropZone onFileSelected={sendFile} />
              </div>
            )}

            {/* Substate 3.2: Transferring (Sending or Receiving) */}
            {(isSending || isReceiving) && (
              <div className="transfer-active animate-fade-in">
                <PogressBar
                  progress={progress}
                  speed={transferSpeed}
                  fileName={fileName}
                  fileSize={fileSize}
                  isSending={isSending}
                  isReceiving={isReceiving}
                />
              </div>
            )}

            {/* Substate 3.3: Transfer Complete */}
            {transferDone && (
              <div className="transfer-complete animate-fade-in">
                <div className="success-icon-container">
                  <svg
                    width="64"
                    height="64"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="success-checkmark"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h2>Transfer Complete!</h2>
                <p className="success-details">
                  <strong>{fileName}</strong> was shared directly.
                </p>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={resetTransferState}
                >
                  Share Another File
                </button>
              </div>
            )}
          </section>
        )}

        {/* State 4: Room Full */}
        {roomState === 'full' && (
          <section className="dashboard-card error-section animate-fade-in">
            <h2>Room is Full</h2>
            <p className="error-description">
              Only two browsers can connect per room. Please create a new share room or join a different code.
            </p>
            <button 
              type="button" 
              className="btn btn-primary"
              onClick={leaveRoom}
            >
              Go to Home Screen
            </button>
          </section>
        )}
      </main>

      <footer className="app-footer">
        <p>No storage limits • Fully encrypted P2P transfer • WebRTC-powered</p>
      </footer>
    </div>
  );
}

export default App;
