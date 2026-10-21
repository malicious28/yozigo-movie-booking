import { useEffect, useRef, useState } from 'react'

// Milliseconds left until `expiresAt`, re-rendering a few times a second. `clockOffsetMs` is
// (server time - local time) from the last server response, so a wrong clock on the user's
// computer cannot make the timer lie. `onExpire` fires once, from a timer, when it reaches zero.
export function useRemainingMs(expiresAt: string | null, clockOffsetMs: number, onExpire?: () => void) {
  const [now, setNow] = useState(() => Date.now())
  const onExpireRef = useRef(onExpire)
  useEffect(() => {
    onExpireRef.current = onExpire
  })

  useEffect(() => {
    if (!expiresAt) return
    const endsAtLocal = new Date(expiresAt).getTime() - clockOffsetMs
    const tick = setInterval(() => setNow(Date.now()), 250)
    const expire = setTimeout(() => onExpireRef.current?.(), Math.max(0, endsAtLocal - Date.now()))
    return () => {
      clearInterval(tick)
      clearTimeout(expire)
    }
  }, [expiresAt, clockOffsetMs])

  return expiresAt ? Math.max(0, new Date(expiresAt).getTime() - (now + clockOffsetMs)) : 0
}
