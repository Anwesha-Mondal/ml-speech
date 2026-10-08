import { useEffect, useRef } from 'react'

/**
 * uiux.md §8 and §47: a very soft radial light that follows the pointer with easing.
 * Off for touch-only devices and for users who prefer reduced motion.
 */
export default function CursorLight() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!fine.matches || still.matches) return

    let tx = window.innerWidth / 2
    let ty = window.innerHeight / 3
    let x = tx
    let y = ty
    let raf = 0
    let running = false

    const frame = () => {
      x += (tx - x) * 0.12
      y += (ty - y) * 0.12
      el.style.setProperty('--lx', `${x.toFixed(1)}px`)
      el.style.setProperty('--ly', `${y.toFixed(1)}px`)
      if (Math.abs(tx - x) > 0.3 || Math.abs(ty - y) > 0.3) {
        raf = requestAnimationFrame(frame)
      } else {
        running = false
      }
    }
    const onMove = (e: PointerEvent) => {
      tx = e.clientX
      ty = e.clientY
      el.style.opacity = '1'
      if (!running) {
        running = true
        raf = requestAnimationFrame(frame)
      }
    }
    const onLeave = () => {
      el.style.opacity = '0'
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return <div ref={ref} className="cursor-light" aria-hidden="true" />
}
