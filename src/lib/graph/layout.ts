import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force'
import type { GraphNode, TrustEdge } from '@/types/graph'

export type SimNode = GraphNode & SimulationNodeDatum
export type SimLink = SimulationLinkDatum<SimNode> & {
  kind: TrustEdge['kind']
  value: number
}

export function createSimulation(
  nodes: SimNode[],
  links: SimLink[],
  width: number,
  height: number,
) {
  return forceSimulation(nodes)
    .force(
      'link',
      forceLink<SimNode, SimLink>(links)
        .id((d) => d.id)
        .distance(80),
    )
    .force('charge', forceManyBody().strength(-200))
    .force('center', forceCenter(width / 2, height / 2))
    .force('collide', forceCollide(20))
}
