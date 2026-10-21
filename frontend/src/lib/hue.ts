import type { CSSProperties } from 'react'

// A stable number per title, used to vary artwork while staying inside the brand palette
// (electric blue + magenta on black) instead of producing random colours.
export const hueOf = (title: string) => [...title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)

const BLUE = '77 163 255'
const PINK = '255 46 147'

// Poster placeholder: a duotone "rim light" whose angle and balance depend on the title.
export const posterBackground = (title: string): CSSProperties => {
  const h = hueOf(title)
  const pinkFirst = h % 2 === 0
  return {
    background: `radial-gradient(90% 60% at ${20 + (h % 60)}% 0%, rgb(${pinkFirst ? PINK : BLUE} / 0.75), transparent 70%),
                 radial-gradient(80% 60% at ${80 - (h % 50)}% 100%, rgb(${pinkFirst ? BLUE : PINK} / 0.6), transparent 70%),
                 #0a0812`,
  }
}

// Neon rim lights behind hero sections: blue from the left, magenta from the right.
export const heroGlow = (title: string): CSSProperties => {
  const h = hueOf(title)
  return {
    background: `radial-gradient(45% 80% at ${h % 20}% 10%, rgb(${BLUE} / 0.32), transparent 70%),
                 radial-gradient(45% 90% at ${90 + (h % 10)}% ${40 + (h % 40)}%, rgb(${PINK} / 0.34), transparent 70%)`,
  }
}
