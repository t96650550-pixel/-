// Call.js
import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from '../auth';
import { io } from 'socket.io-client';

export default function Call(){
  const localV = useRef();
  const remoteV = useRef();
  const pcRef = useRef();
  const socketRef = useRef();
  const { token, user } = useAuth();
  const [inCall, setInCall] = useState(false);

  useEffect(() => {
    if (!token) return;
    const s = io(process.env.REACT_APP_SOCKET || (process.env.REACT_APP_API || ''), { auth: { token }});
    socketRef.current = s;
    s.on('webrtc-offer', async ({ from, sdp }) => {
      if (!pcRef.current) await startLocalStream();
      await pcRef.current.setRemoteDescription(sdp);
      const ans = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(ans);
      s.emit('webrtc-answer', { toId: from, sdp: pcRef.current.localDescription });
    });
    s.on('webrtc-answer', async ({ sdp }) => {
      await pcRef.current.setRemoteDescription(sdp);
    });
    s.on('webrtc-ice', ({ candidate }) => {
      if (pcRef.current) pcRef.current.addIceCandidate(candidate).catch(()=>{});
    });
    return () => s.disconnect();
  }, [token]);

  async function startLocalStream() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localV.current.srcObject = stream;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    pc.ontrack = (ev) => { remoteV.current.srcObject = ev.streams[0]; };
    pc.onicecandidate = (e) => {
      if (e.candidate) socketRef.current.emit('webrtc-ice', { candidate: e.candidate, toId: window.prompt('Nhập id người nhận (demo):') });
    };
    return pc;
  }

  const startCall = async () => {
    if (!pcRef.current) await startLocalStream();
    const pc = pcRef.current;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    // for demo: ask who to call
    const toId = window.prompt('Nhập user id để gọi (demo):');
    if (!toId) return;
    socketRef.current.emit('webrtc-offer', { toId, sdp: pc.localDescription });
    setInCall(true);
  };

  return (
    <div className="app-card">
      <h3>Video Call (demo)</h3>
      <div style={{display:'flex', gap:12}}>
        <video ref={localV} autoPlay muted style={{width:320,background:'#000'}} />
        <video ref={remoteV} autoPlay style={{width:320,background:'#000'}} />
      </div>
      <div style={{marginTop:10}}>
        <button className="btn" onClick={startCall}>Gọi (nhập user id demo)</button>
      </div>
    </div>
  );
}
