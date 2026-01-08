/**
 * Graph Constants
 * Sacred geometry constants and colors for the cabal graph
 */

// Golden ratio constants
export const PHI = 1.61803
export const PHI_INV = 0.61803

// Brand colors (matches dark mode --primary)
export const BRAND_GOLD = { r: 212, g: 146, b: 54 }
export const BRAND_BG = { r: 28, g: 26, b: 24 }

export const SACRED_COLORS = {
  nodeFill: `rgba(${BRAND_BG.r}, ${BRAND_BG.g}, ${BRAND_BG.b}, 0.98)`,
  nodeStroke: `rgba(${BRAND_GOLD.r}, ${BRAND_GOLD.g}, ${BRAND_GOLD.b}, 0.7)`,
  nodeStrokeInner: `rgba(${BRAND_GOLD.r}, ${BRAND_GOLD.g}, ${BRAND_GOLD.b}, 0.2)`,
  nodeGlowInner: `rgba(${BRAND_GOLD.r}, ${BRAND_GOLD.g}, ${BRAND_GOLD.b}, 0.15)`,
  nodeGlowOuter: `rgba(${BRAND_GOLD.r}, ${BRAND_GOLD.g}, ${BRAND_GOLD.b}, 0.05)`,
  labelColor: "rgba(245, 240, 230, 0.95)",
  linkColor: `rgba(${BRAND_GOLD.r}, ${BRAND_GOLD.g}, ${BRAND_GOLD.b}, 0.3)`,
}

// Initial contribution for genesis
export const GENESIS_CONTRIBUTION = "0.00001"

// Node sizing
export const BASE_NODE_RADIUS = 55
export const MIN_NODE_RADIUS = 40
export const MAX_NODE_RADIUS = 70

// Panel sizing
export const BASE_PANEL_SIZE = 100
export const MIN_PANEL_SIZE = 80
export const MAX_PANEL_SIZE = 120
