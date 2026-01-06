/**
 * Sacred Geometry Animation Utilities
 * 
 * Animation timing and easing based on the golden ratio (φ = 1.618)
 * for harmonious, natural-feeling transitions.
 */

// Golden ratio constants
export const PHI = 1.618033988749
export const PHI_INV = 0.618033988749

// Golden ratio timing durations (ms)
export const ANIM_DURATION = {
  instant: 0,
  micro: 62,        // ~φ⁻⁵ seconds × 1000
  swift: 100,       // ~φ⁻⁴ seconds × 1000  
  quick: 162,       // ~φ⁻³ seconds × 1000
  natural: 262,     // ~φ⁻² seconds × 1000
  smooth: 382,      // Matches our existing 382ms
  relaxed: 500,     // Matches our existing 500ms
  slow: 618,        // ~φ⁻¹ seconds × 1000
  stately: 1000,    // 1 second
} as const

// Easing functions
export const easing = {
  // Standard ease-out (cubic) - natural deceleration
  easeOutCubic: (t: number): number => 1 - Math.pow(1 - t, 3),
  
  // Ease-in-out (cubic) - smooth start and end
  easeInOutCubic: (t: number): number => 
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  
  // Ease-out (quad) - gentler deceleration
  easeOutQuad: (t: number): number => 1 - (1 - t) * (1 - t),
  
  // Ease-in-out (quad) - gentle start and end
  easeInOutQuad: (t: number): number => 
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  
  // Linear (no easing)
  linear: (t: number): number => t,
  
  // Bounce out - playful ending
  bounceOut: (t: number): number => {
    const n1 = 7.5625
    const d1 = 2.75
    if (t < 1 / d1) return n1 * t * t
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375
    return n1 * (t -= 2.625 / d1) * t + 0.984375
  },
}

/**
 * Animate a value from start to end over a duration.
 * Returns a cleanup function to cancel the animation.
 */
export function animateValue(
  options: {
    from: number
    to: number
    duration?: number
    easing?: (t: number) => number
    onUpdate: (value: number) => void
    onComplete?: () => void
  }
): () => void {
  const {
    from,
    to,
    duration = ANIM_DURATION.smooth,
    easing: easingFn = easing.easeOutCubic,
    onUpdate,
    onComplete,
  } = options
  
  const startTime = performance.now()
  let animationFrame: number | null = null
  
  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    const easedProgress = easingFn(progress)
    
    const value = from + (to - from) * easedProgress
    onUpdate(value)
    
    if (progress < 1) {
      animationFrame = requestAnimationFrame(animate)
    } else {
      onComplete?.()
    }
  }
  
  animationFrame = requestAnimationFrame(animate)
  
  // Return cleanup function
  return () => {
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame)
    }
  }
}

/**
 * Animate multiple values in parallel.
 * Returns a cleanup function to cancel all animations.
 */
export function animateValues(
  options: {
    values: { from: number; to: number; onUpdate: (value: number) => void }[]
    duration?: number
    easing?: (t: number) => number
    onComplete?: () => void
  }
): () => void {
  const {
    values,
    duration = ANIM_DURATION.smooth,
    easing: easingFn = easing.easeOutCubic,
    onComplete,
  } = options
  
  const startTime = performance.now()
  let animationFrame: number | null = null
  
  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    const easedProgress = easingFn(progress)
    
    values.forEach(({ from, to, onUpdate }) => {
      const value = from + (to - from) * easedProgress
      onUpdate(value)
    })
    
    if (progress < 1) {
      animationFrame = requestAnimationFrame(animate)
    } else {
      onComplete?.()
    }
  }
  
  animationFrame = requestAnimationFrame(animate)
  
  return () => {
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame)
    }
  }
}

/**
 * Create a spring-like animation for more natural motion.
 */
export function animateSpring(
  options: {
    from: number
    to: number
    stiffness?: number
    damping?: number
    onUpdate: (value: number) => void
    onComplete?: () => void
  }
): () => void {
  const {
    from,
    to,
    stiffness = 100,
    damping = 10,
    onUpdate,
    onComplete,
  } = options
  
  let position = from
  let velocity = 0
  let animationFrame: number | null = null
  let lastTime = performance.now()
  
  const animate = (currentTime: number) => {
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.064) // Cap at ~16fps minimum
    lastTime = currentTime
    
    // Spring physics
    const displacement = position - to
    const springForce = -stiffness * displacement
    const dampingForce = -damping * velocity
    const acceleration = springForce + dampingForce
    
    velocity += acceleration * deltaTime
    position += velocity * deltaTime
    
    onUpdate(position)
    
    // Check if settled
    if (Math.abs(displacement) < 0.01 && Math.abs(velocity) < 0.01) {
      onUpdate(to) // Snap to target
      onComplete?.()
    } else {
      animationFrame = requestAnimationFrame(animate)
    }
  }
  
  animationFrame = requestAnimationFrame(animate)
  
  return () => {
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame)
    }
  }
}
