
import { useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

function MyApp({ Component, pageProps }) {
  // optional: handle auth state change to persist session
  useEffect(() => {
    const { data: d } = supabase.auth.onAuthStateChange((event, session) => {
      // optional: save to localStorage or cookie
    })
    return () => d.unsubscribe()
  }, [])

  return <Component {...pageProps} />
}

export default MyApp
