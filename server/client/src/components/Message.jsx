import React from 'react';
export default function Message({ msg, me, onRecall }){
  const time = new Date(msg.createdAt).toLocaleTimeString();
  return (
    <div className={`msg ${me ? 'me' : ''}`}>
      <div style={{fontSize:12,opacity:0.8}}>{msg.displayName}</div>
      <div className="bubble">
        {msg.recalled ? <i style={{opacity:0.8}}>Tin nhắn đã được thu hồi</i> :
          msg.type === 'text' ? <div>{msg.content}</div> :
          <audio controls src={msg.content} />
        }
        <div style={{fontSize:11,opacity:0.7,marginTop:6,display:'flex',gap:8,alignItems:'center'}}>
          <span>{time}</span>
          {me && !msg.recalled && <button onClick={onRecall} className="small" style={{background:'transparent',border:'none',color:'#ffb4b4'}}>Thu hồi</button>}
        </div>
      </div>
    </div>
  )
}
