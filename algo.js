"use strict";
const EPS = 1e-12;

/* ---------- Bellman-Ford (records every step for the UI) ---------- */
function bellmanFord(V, edges) {
  const dist = Array(V).fill(0);      // all 0: finds a negative cycle anywhere in the graph
  const parentEdge = Array(V).fill(-1); // index of the edge that last improved each node
  const steps = [];
  let found = null;

  for (let p = 1; p < V; p++) {
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const relaxed = dist[e.u] + e.w < dist[e.v] - EPS;
      if (relaxed) { dist[e.v] = dist[e.u] + e.w; parentEdge[e.v] = i; }
      steps.push({ phase: `Pass ${p} of ${V - 1}`, i, relaxed, dist: dist.slice() });
    }
  }
  for (let i = 0; i < edges.length; i++) {          // V-th pass: detection
    const e = edges[i];
    const relaxed = dist[e.u] + e.w < dist[e.v] - EPS;
    steps.push({ phase: "Detection pass", i, relaxed, dist: dist.slice(), detected: relaxed });
    if (relaxed) {
      parentEdge[e.v] = i;
      let x = e.v;
      for (let k = 0; k < V; k++) x = edges[parentEdge[x]].u;   // step back into the cycle
      const list = []; let c = x;
      do { const id = parentEdge[c]; list.push(id); c = edges[id].u; } while (c !== x);
      found = list.reverse();                      // edges in trade order
      break;
    }
  }
  return { steps, cycle: found };
}
