import { create } from 'zustand'
import type { GraphNode, TrustEdge } from '@/types/graph'
import { MAX_GRAPH_EDGES } from '@/config/constants'

type GraphStoreState = {
  nodes: Map<string, GraphNode>
  edges: TrustEdge[]
  addNode: (node: GraphNode) => void
  addEdge: (edge: TrustEdge) => void
  addBatch: (payload: { nodes?: GraphNode[]; edges?: TrustEdge[] }) => void
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
    set((state) => ({
      edges: [...state.edges, edge].slice(-MAX_GRAPH_EDGES),
    })),

  addBatch: ({ nodes: newNodes, edges: newEdges }) => {
    if ((!newNodes || newNodes.length === 0) && (!newEdges || newEdges.length === 0)) return
    const nodes = newNodes && newNodes.length > 0 ? new Map(get().nodes) : get().nodes
    if (newNodes) for (const node of newNodes) nodes.set(node.id, node)
    const edges = newEdges && newEdges.length > 0
      ? [...get().edges, ...newEdges].slice(-MAX_GRAPH_EDGES)
      : get().edges
    set({ nodes, edges })
  },

  clear: () => set({ nodes: new Map(), edges: [] }),
}))
