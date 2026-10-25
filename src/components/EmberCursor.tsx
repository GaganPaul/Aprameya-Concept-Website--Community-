import { useEffect, useRef } from "react"

const NATIVE_CURSOR_TARGETS =
  "input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox'], iframe, [draggable='true']"
const INTERACTIVE_TARGETS =
  "a, button, [role='button'], input, select, textarea, summary"

export default function EmberCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cursor = cursorRef.current
    if (!cursor) return

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)")
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const particles = Array.from(
      cursor.querySelectorAll<HTMLElement>(".ember-wisp-particle"),
    )
    let targetX = 0
    let targetY = 0
    let previousX = 0
    let previousY = 0
    let previousParticleTime = 0
    let particleIndex = 0
    let distanceSinceParticle = 0
    let animationFrame = 0
    let dragInProgress = false
    let hasPointer = false

    const hide = () => {
      cursor.classList.remove("is-visible")
    }

    const restoreNativeCursor = () => {
      document.body.classList.remove("golden-wisp-active")
      hasPointer = false
      distanceSinceParticle = 0
      hide()
    }

    const updateContext = (target: EventTarget | null) => {
      const element = target instanceof Element ? target : null
      cursor.classList.toggle(
        "is-interactive",
        !!element?.closest(INTERACTIVE_TARGETS),
      )
      cursor.classList.toggle(
        "is-rekindle",
        !!element?.closest(".bonfire-copy, .bonfire-scene"),
      )
      cursor.classList.toggle(
        "is-game-control",
        !!element?.closest(
          "#ember-hunt .maze-overlay button, #ember-hunt .maze-controls button",
        ),
      )
      cursor.classList.toggle(
        "is-in-game",
        !!element?.closest(".maze-board-playing"),
      )

      if (element?.closest(NATIVE_CURSOR_TARGETS)) {
        restoreNativeCursor()
        return false
      }
      return true
    }

    const render = () => {
      animationFrame = 0
      cursor.style.setProperty("--cursor-x", `${targetX}px`)
      cursor.style.setProperty("--cursor-y", `${targetY}px`)
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || dragInProgress) return
      if (!finePointer.matches) {
        restoreNativeCursor()
        return
      }

      targetX = event.clientX
      targetY = event.clientY
      if (!updateContext(event.target)) return

      const isActive = document.body.classList.contains("golden-wisp-active")
      if (!isActive) {
        cursor.style.setProperty("--cursor-x", `${targetX}px`)
        cursor.style.setProperty("--cursor-y", `${targetY}px`)
        previousX = targetX
        previousY = targetY
        previousParticleTime = performance.now()
        hasPointer = true
      }
      cursor.classList.add("is-visible")
      document.body.classList.add("golden-wisp-active")
      if (isActive && !animationFrame)
        animationFrame = requestAnimationFrame(render)

      const now = performance.now()
      const distance = Math.hypot(targetX - previousX, targetY - previousY)
      const canEmitParticles =
        hasPointer &&
        !reducedMotion.matches &&
        !cursor.classList.contains("is-in-game")
      if (canEmitParticles) distanceSinceParticle += distance
      else distanceSinceParticle = 0
      if (
        canEmitParticles &&
        distanceSinceParticle >= 9 &&
        now - previousParticleTime >= 48
      ) {
        const particle = particles[particleIndex]
        particleIndex = (particleIndex + 1) % particles.length
        particle.style.left = `${previousX + (Math.random() - 0.5) * 2}px`
        particle.style.top = `${previousY + (Math.random() - 0.5) * 2}px`
        particle.classList.remove("is-spawning")
        void particle.offsetWidth
        particle.classList.add("is-spawning")
        distanceSinceParticle = 0
        previousParticleTime = now
      }
      previousX = targetX
      previousY = targetY
    }

    const handlePointerOut = (event: PointerEvent) => {
      if (event.relatedTarget === null) restoreNativeCursor()
    }

    const handleDragStart = () => {
      dragInProgress = true
      restoreNativeCursor()
    }

    const handleDragEnd = () => {
      dragInProgress = false
    }

    const handleCapabilityChange = () => {
      if (!finePointer.matches) restoreNativeCursor()
    }

    document.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    })
    document.addEventListener("pointerout", handlePointerOut, {
      passive: true,
    })
    document.addEventListener("dragstart", handleDragStart)
    document.addEventListener("dragend", handleDragEnd)
    finePointer.addEventListener("change", handleCapabilityChange)

    return () => {
      document.removeEventListener("pointermove", handlePointerMove)
      document.removeEventListener("pointerout", handlePointerOut)
      document.removeEventListener("dragstart", handleDragStart)
      document.removeEventListener("dragend", handleDragEnd)
      finePointer.removeEventListener("change", handleCapabilityChange)
      document.body.classList.remove("golden-wisp-active")
      if (animationFrame) cancelAnimationFrame(animationFrame)
    }
  }, [])

  return (
    <div ref={cursorRef} className="ember-cursor" aria-hidden="true">
      <span className="ember-wisp-particle ember-wisp-particle-small" />
      <span className="ember-wisp-particle ember-wisp-particle-large" />
      <span className="ember-wisp-particle ember-wisp-particle-small" />
      <span className="ember-cursor-core" />
    </div>
  )
}
