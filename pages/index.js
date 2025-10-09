import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import useSWR from 'swr'

const fetcher = async (query) => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(100)
  if (error) throw error
  return data
}

export default function Home() {
  const [session, setSession] = useState(null)
  const [text, setText] = useState('')
  const [room, setRoom] = useState('general')
  const [typingUsers, setTypingUsers] = useState({})
  const inputRef = useRef(null)

  const { data: msgs, mutate } = useSWR('messages', fetcher, { refreshInterval: 0 })

  useEffect(() => {
    // load session
    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, s) =>
      setSession(s)
    )
    return () => authListener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return

    // subscribe realtime to messages table
    const channel = supabase.channel(`room:${room}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `room=eq.${room}` }, payload => {
        // payload.record, payload.eventType
        mutate(async (current) => {
          if (payload.eventType === 'INSERT') return [...(current || []), payload.record]
          if (payload.eventType === 'UPDATE') return (current || []).map(m => m.id === payload.record.id ? payload.record : m)
          if (payload.eventType === 'DELETE') return (current || []).filter(m => m.id !== payload.record.id)
          return current
        }, { revalidate: false })
      })
      // presence for typing indicator (optional)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session, room, mutate])

  const signIn = async () => {
    const email = prompt('Email để đăng nhập (test)') || ''
    await supabase.auth.signInWithOtp({ email })
    alert('Check email để hoàn tất đăng nhập (magic link) — hoặc cấu hình password flow trên Supabase')
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
  }

  const sendMessage = async () => {
    if (!text.trim()) return
    // optimistic UI
    const temp = { id: `temp-${Date.now()}`, content: text, user_email: session?.user?.email || 'guest', room, created_at: new Date().toISOString() }
    mutate((cur)=>[...(cur||[]), temp], { revalidate: false })
    setText('')
    await supabase.from('messages').insert([{ content: text, room, user_id: session?.user?.id || null }])
    // server will emit INSERT and mutate with real data
  }

  const deleteMessage = async (id) => {
    // only admin or owner (check on server ideally)
    await fetch('/api/moderation/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id })
    })
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 20 }}>
      <header style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h2>Chat — Room: {room}</h2>
        <div>
          {session ? <>
            <span>{session.user.email}</span>
            <button onClick={signOut} style={{ marginLeft: 8 }}>Sign out</button>
          </> : <button onClick={signIn}>Sign in</button>}
        </div>
      </header>

      <div style={{ display:'flex', gap: 12 }}>
        <aside style={{ width: 200 }}>
          <h4>Rooms</h4>
          {['general','dev','random'].map(r => (
            <div key={r}>
              <button onClick={()=>setRoom(r)} style={{ fontWeight: r===room ? 'bold' : 'normal' }}>{r}</button>
            </div>
          ))}
        </aside>

        <main style={{ flex: 1 }}>
          <div style={{ height: 400, overflow: 'auto', border: '1px solid #ddd', padding: 8 }}>
            {(msgs || []).map(m => (
              <div key={m.id} style={{ padding: 6, borderBottom: '1px dashed #eee' }}>
                <div style={{ fontSize: 12, color: '#666' }}>{m.user_email || m.user_id} • <small>{new Date(m.created_at).toLocaleString()}</small></div>
                <div>{m.deleted ? <i>Message deleted</i> : m.content}</div>
                <div>
                  {!m.deleted && <button onClick={()=>deleteMessage(m.id)} style={{ fontSize:12 }}>Delete</button>}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 8 }}>
            <input ref={inputRef} value={text} onChange={(e)=>setText(e.target.value)} onKeyDown={(e)=>e.key==='Enter' && sendMessage()} placeholder="Nhập tin nhắn..." style={{ width: '80%', padding: 8 }} />
            <button onClick={sendMessage} style={{ padding: 8, marginLeft: 8 }}>Send</button>
          </div>
        </main>
      </div>
    </div>
  )
}
