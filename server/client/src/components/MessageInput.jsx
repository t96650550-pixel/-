import React, {useState, useRef} from 'react';

export default function MessageInput({ onSend, onSendVoice, socket, token }){
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const mediaRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecord = async () => {
    setRecording(true);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRef.current = stream;
    const mr = new MediaRecorder(stream);
    recorderRef.current = mr;
    chunksRef.current = [];
    mr.ondataavailable = e => chunksRef.current.push(e.data);
    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const file = new File([blob], 'voice.webm', { type: 'audio/webm' });
      onSendVoice(file);
      stream.getTracks().forEach(t => t.stop());
      setRecording(false);
    };
    mr.start();
  };

  const stopRecord = () => {
    if (recorderRef.current) recorderRef.current.stop();
  };

  const submit = (e) => {
    e?.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  };

  const handleTyping = () => {
    if (socket) socket.emit('typing');
  };

  return (
    <form onSubmit={submit} style={{marginTop:8}}>
      <div className="input-row">
        <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{ if (e.key === 'Enter' && !e.shiftKey) submit(e); }} onInput={handleTyping} className="input" placeholder="Gửi tin..." />
        <button type="submit" className="btn">Gửi</button>
        <div className="record-btn" onMouseDown={startRecord} onMouseUp={stopRecord} onTouchStart={startRecord} onTouchEnd={stopRecord} title="Nhấn giữ để ghi âm">
          {recording ? '●' : '🎤'}
        </div>
      </div>
    </form>
  );
}
