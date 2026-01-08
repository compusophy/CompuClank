/**
 * Graph Helper Functions
 * Distance-based calculations for hierarchical cabal graph
 */

export interface CabalInfo {
  id: bigint
  symbol: string
  phase: number
  tbaAddress: string
  parentCabalId: bigint
}

/**
 * Build ancestry map: cabalId -> array of ancestor IDs (immediate parent first, then grandparent, etc.)
 */
export function buildAncestryMap(cabals: readonly CabalInfo[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  const cabalById = new Map(cabals.map(c => [c.id.toString(), c]))
  
  cabals.forEach(cabal => {
    const ancestors: string[] = []
    let currentId = cabal.parentCabalId.toString()
    const selfId = cabal.id.toString()
    
    // Walk up the tree until we hit root (parent == self) or missing node
    while (currentId !== selfId) {
      const parent = cabalById.get(currentId)
      if (!parent) break
      ancestors.push(currentId)
      if (parent.parentCabalId.toString() === currentId) break // Root reached
      currentId = parent.parentCabalId.toString()
    }
    map.set(selfId, ancestors)
  })
  return map
}

/**
 * Get ancestor distance: how many levels UP from focused to this node
 * Returns: 0 = self, 1 = parent, 2 = grandparent, etc., -1 = not an ancestor
 */
export function getAncestorDistance(focusedId: string, nodeId: string, ancestryMap: Map<string, string[]>): number {
  if (focusedId === nodeId) return 0
  const ancestors = ancestryMap.get(focusedId) ?? []
  const idx = ancestors.indexOf(nodeId)
  return idx >= 0 ? idx + 1 : -1
}

/**
 * Get descendant distance: how many levels DOWN from focused to this node
 * Returns: 0 = self, 1 = child, 2 = grandchild, etc., -1 = not a descendant
 */
export function getDescendantDistance(focusedId: string, nodeId: string, ancestryMap: Map<string, string[]>): number {
  if (focusedId === nodeId) return 0
  const nodeAncestors = ancestryMap.get(nodeId) ?? []
  const idx = nodeAncestors.indexOf(focusedId)
  return idx >= 0 ? idx + 1 : -1
}

/**
 * Check if two nodes are siblings (share same parent)
 */
export function areSiblings(nodeA: string, nodeB: string, cabals: readonly CabalInfo[]): boolean {
  if (nodeA === nodeB) return false
  const a = cabals.find(c => c.id.toString() === nodeA)
  const b = cabals.find(c => c.id.toString() === nodeB)
  if (!a || !b) return false
  const aParent = a.parentCabalId.toString()
  const bParent = b.parentCabalId.toString()
  // Both must have same parent, and parent must not be self (not root checking itself)
  return aParent === bParent && aParent !== nodeA && bParent !== nodeB
}

/**
 * Get all children of a node
 */
export function getChildren(nodeId: string, cabals: readonly CabalInfo[]): CabalInfo[] {
  return cabals
    .filter(c => c.parentCabalId.toString() === nodeId && c.id.toString() !== nodeId)
    .sort((a, b) => Number(a.id) - Number(b.id))
}
