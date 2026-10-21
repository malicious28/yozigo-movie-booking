import { ReactLenis, useLenis } from 'lenis/react'
import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// New pages start at the top, like a normal navigation.
function ScrollToTopOnRouteChange() {
  const { pathname } = useLocation()
  const lenis = useLenis()
  useEffect(() => {
    if (lenis) lenis.scrollTo(0, { immediate: true })
    else window.scrollTo(0, 0)
  }, [pathname, lenis])
  return null
}

// Smooth, inertia-based page scrolling with Lenis (darkroomengineering/lenis). It only smooths
// wheel/trackpad input; touch, keyboard scrolling and find-in-page stay native. In-page anchor
// links glide to their target (offset for the sticky header). Off for reduced-motion users.
export function SmoothScroll({ children }: { children: ReactNode }) {
  if (prefersReducedMotion()) {
    return (
      <>
        <ScrollToTopOnRouteChange />
        {children}
      </>
    )
  }
  return (
    <ReactLenis root options={{ lerp: 0.1, anchors: { offset: -96 } }}>
      <ScrollToTopOnRouteChange />
      {children}
    </ReactLenis>
  )
}
