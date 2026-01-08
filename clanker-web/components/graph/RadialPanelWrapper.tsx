"use client"

import { ReactNode } from "react"

interface RadialPanelWrapperProps {
  panelSize: number
  x: number
  y: number
  delayClass: string
  menuAnimState: 'entering' | 'entered' | 'exiting' | 'exited'
  zIndex?: number
  children: ReactNode
}

/**
 * Wrapper for radial menu panels with consistent styling and animation
 */
export function RadialPanelWrapper({
  panelSize,
  x,
  y,
  delayClass,
  menuAnimState,
  zIndex = 2,
  children,
}: RadialPanelWrapperProps) {
  const animClass = 
    menuAnimState === 'entering' ? `radial-panel-enter ${delayClass}` : 
    menuAnimState === 'exiting' ? 'radial-panel-exit' : 'radial-panel-visible'

  return (
    <div 
      className={`absolute pointer-events-auto bg-background/95 border border-primary/40 shadow-xl backdrop-blur-md flex flex-col items-center justify-center text-center overflow-hidden rounded-full radial-panel ${animClass}`}
      style={{
        width: panelSize,
        height: panelSize,
        left: x - panelSize / 2,
        top: y - panelSize / 2,
        transformOrigin: `${panelSize / 2 - x}px ${panelSize / 2 - y}px`,
        zIndex,
      }}
    >
      {children}
    </div>
  )
}
