import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from "d3-force";

export function createSkillSimulation({ nodes, links, width, height, onTick }) {
  const simulation = forceSimulation(nodes)
    .force("link", forceLink(links).id((datum) => datum.id).distance(180).strength(0.16))
    .force("charge", forceManyBody().strength(-150))
    .force("collide", forceCollide(70))
    .force("center", forceCenter(width / 2, height / 2).strength(0.025))
    .force("anchor-x", forceX((datum) => datum.anchorX).strength(0.05))
    .force("anchor-y", forceY((datum) => datum.anchorY).strength(0.05))
    .alphaDecay(0.085)
    .alphaMin(0.015)
    .velocityDecay(0.58)
    .on("tick", onTick)
    .stop();

  simulation.updateCenter = (nextWidth, nextHeight) => {
    simulation.force("center", forceCenter(nextWidth / 2, nextHeight / 2).strength(0.025));
  };

  return simulation;
}
