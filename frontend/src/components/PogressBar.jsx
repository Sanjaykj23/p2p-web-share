import React from 'react';

const formatBytes = (bytes, decimals = 2) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export default function PogressBar({ progress, speed, fileName, fileSize, isSending, isReceiving }) {
  const currentAction = isSending ? 'Sending' : isReceiving ? 'Receiving' : 'Transferring';
  const processedBytes = Math.round((progress / 100) * fileSize);

  return (
    <div className="progress-container">
      <div className="progress-header">
        <div className="progress-status">
          <span className={`status-dot pulsating-${currentAction.toLowerCase()}`} />
          <span className="status-text">{currentAction}...</span>
        </div>
        <div className="progress-percent">{progress}%</div>
      </div>

      <div className="progress-file-info">
        <div className="progress-filename" title={fileName}>
          {fileName}
        </div>
        <div className="progress-bytes">
          {formatBytes(processedBytes)} of {formatBytes(fileSize)}
        </div>
      </div>

      <div className="progress-bar-track">
        <div 
          className="progress-bar-fill" 
          style={{ width: `${progress}%` }} 
        />
      </div>

      <div className="progress-footer">
        {speed > 0 && (
          <div className="progress-speed" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            <span>{speed} MB/s</span>
          </div>
        )}
      </div>
    </div>
  );
}
