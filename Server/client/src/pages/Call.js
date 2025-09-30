import React, { useRef } from 'react';
import { useAuth } from '../auth';

export default function Call(){
  const localV = useRef();
  const remoteV = useRef();
  const pcRef = useRef();
  const { token } = useAuth();

  // This is a skeleton — the signaling is via socket.io in server.js
  // To fully work you need socket.io client + handling offer/answer/ice (already prepared in server)
  return (
    <div className="app-card">
      <h3>Video Call (demo)</h3>
      <div style={{display:'flex', gap:12}}>
        <video ref={localV} autoPlay muted style={{width:320,background:'#000'}} />
        <video ref={remoteV} autoPlay style={{width:320,background:'#000'}} />
      </div>
      <p className="small">Gọi video cần grant camera/microphone và STUN/TURN (xem README để cấu hình).</p>
    </div>
  );
}
