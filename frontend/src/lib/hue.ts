import type { CSSProperties } from 'react'

// A stable hue per title, so a movie gets the same colours on every page.
export const hueOf = (title: string) => [...title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)

export const posterBackground = (title: string): CSSProperties => ({
  background: `linear-gradient(160deg, hsl(${hueOf(title)} 45% 36%), hsl(${hueOf(title)} 50% 13%))`,
})

// Coloured glow behind dark hero bands.
export const heroGlow = (title: string): CSSProperties => ({
  background: `radial-gradient(60% 120% at 85% 20%, hsl(${hueOf(title)} 70% 45% / 0.55), transparent 70%),
               radial-gradient(50% 90% at 10% 100%, hsl(${(hueOf(title) + 40) % 360} 70% 40% / 0.35), transparent 70%)`,
})
