import { create } from 'zustand'
import type { GraphNode, TrustEdge } from '@/types/graph'

type GraphStoreState = {
  nodes: Map<string, GraphNode>
  edges: TrustEdge[]
  addNode: (node: GraphNode) => void
  addEdge: (edge: TrustEdge) => void
  clear: () => void
}

export const useGraphStore = create<GraphStoreState>()((set, get) => ({
  nodes: new Map(),
  edges: [],

  addNode: (node) => {
    const nodes = new Map(get().nodes)
    nodes.set(node.id, node)
    set({ nodes })
  },

  addEdge: (edge) =>
    set((state) => ({ edges: [...state.edges, edge] })),

  clear: () => set({ nodes: new Map(), edges: [] }),
}))
