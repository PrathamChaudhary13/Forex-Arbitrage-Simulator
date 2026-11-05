"use strict";
const $ = id => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";

const PRESETS = {
  arb:  { cur: "USD EUR GBP", pairs: [["USD","EUR",0.90,0.91],["EUR","GBP",0.86,0.87],["GBP","USD",1.30,1.31]] },
  none: { cur: "USD EUR GBP", pairs: [["USD","EUR",0.92,0.921],["EUR","GBP",0.85,0.851],["GBP","USD",1.278,1.279]] },
  four: { cur: "USD EUR GBP JPY", pairs: [["USD","EUR",0.90,0.91],["EUR","GBP",0.86,0.87],["GBP","USD",1.30,1.31],["USD","JPY",150,150.2],["JPY","EUR",0.0060,0.0061]] }
};

let names = [], edges = [], steps = [], cycle = null, pos = 0, timer = null, nodePos = [];

/* Bellman-Ford now lives in algo.js (shared with the live-market page) */

/* ---------- Input handling ---------- */
function addRow(v = ["", "", "", ""]) {
  const tr = document.createElement("tr");
  tr.innerHTML = v.map((x, k) => `<td><input ${k > 1 ? 'type="number" step="any" min="0"' : ""} value="${x}" aria-label="${["Base","Quote","Bid","Ask"][k]}"></td>`).join("")
    + `<td><button class="del" title="Remove pair" aria-label="Remove pair">×</button></td>`;
  tr.querySelector(".del").onclick = () => tr.remove();
  $("pairs").tBodies[0].appendChild(tr);
}
function loadPreset(key) {
  const p = PRESETS[key];
  $("cur").value = p.cur;
  $("pairs").tBodies[0].innerHTML = "";
  p.pairs.forEach(addRow);
  $("msg").textContent = "";
}
function readInput() {
  const list = $("cur").value.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const unique = [...new Set(list)];
  if (unique.length < 3) throw "Enter at least 3 different currencies to form a triangular loop.";
  const index = Object.fromEntries(unique.map((n, i) => [n, i]));
  const es = [];
  const rows = [...$("pairs").tBodies[0].rows];
  if (!rows.length) throw "Add at least one trading pair.";
  rows.forEach((tr, r) => {
    const [b, q, bid, ask] = [...tr.querySelectorAll("input")].map(i => i.value.trim());
    const base = b.toUpperCase(), quote = q.toUpperCase(), bd = parseFloat(bid), ak = parseFloat(ask);
    if (!(base in index) || !(quote in index)) throw `Row ${r + 1}: "${!(base in index) ? base : quote}" is not in the currency list.`;
    if (base === quote) throw `Row ${r + 1}: base and quote must be different.`;
    if (!(bd > 0) || !(ak > 0)) throw `Row ${r + 1}: bid and ask must be positive numbers.`;
    if (bd > ak) throw `Row ${r + 1}: bid cannot be higher than ask.`;
    const u = index[base], v = index[quote];
    es.push({ u, v, rate: bd,     w: -Math.log(bd),     label: `${base}→${quote}` });  // sell base at bid
    es.push({ u: v, v: u, rate: 1 / ak, w: -Math.log(1 / ak), label: `${quote}→${base}` }); // buy base at ask
  });
  return { names: unique, edges: es };
}

/* ---------- Graph drawing ---------- */
function layout() {
  const n = names.length;
  nodePos = names.map((_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return { x: 260 + 150 * Math.cos(a), y: 210 + 150 * Math.sin(a) };
  });
}
function draw() {
  const svg = $("graph");
  const cur = pos > 0 ? steps[pos - 1] : null;
  const atEnd = pos === steps.length && cycle;
  const cycleSet = new Set(atEnd ? cycle : []);
  const cycleNodes = new Set(atEnd ? cycle.map(i => edges[i].u) : []);
  let html = "";
  edges.forEach((e, i) => {
    const a = nodePos[e.u], b = nodePos[e.v];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    const s = { x: a.x + ux * 24, y: a.y + uy * 24 }, t = { x: b.x - ux * 28, y: b.y - uy * 28 };
    const c = { x: (a.x + b.x) / 2 - uy * 34, y: (a.y + b.y) / 2 + ux * 34 };
    const m = { x: 0.25 * s.x + 0.5 * c.x + 0.25 * t.x, y: 0.25 * s.y + 0.5 * c.y + 0.25 * t.y };
    const isCur = cur && cur.i === i;
    const cls = ["edge", isCur ? "cur" : "", isCur && cur.relaxed ? "ok" : "", cycleSet.has(i) ? "cycle" : ""].join(" ");
    const tipCls = cycleSet.has(i) ? "cycle" : isCur ? (cur.relaxed ? "cur ok" : "cur") : "";
    const ang = Math.atan2(t.y - c.y, t.x - c.x), L = 9, W = 4.5;
    const p1 = `${t.x},${t.y}`, p2 = `${t.x - L * Math.cos(ang) + W * Math.sin(ang)},${t.y - L * Math.sin(ang) - W * Math.cos(ang)}`,
          p3 = `${t.x - L * Math.cos(ang) - W * Math.sin(ang)},${t.y - L * Math.sin(ang) + W * Math.cos(ang)}`;
    html += `<g class="${cls}"><path d="M${s.x},${s.y} Q${c.x},${c.y} ${t.x},${t.y}"/><polygon class="tip ${tipCls}" points="${p1} ${p2} ${p3}"/>` +
            `<text x="${m.x}" y="${m.y}">${e.rate.toPrecision(5)}</text></g>`;
  });
  names.forEach((n, i) => {
    html += `<g class="node ${cycleNodes.has(i) ? "cycle" : ""}"><circle cx="${nodePos[i].x}" cy="${nodePos[i].y}" r="22"/><text x="${nodePos[i].x}" y="${nodePos[i].y}">${n}</text></g>`;
  });
  svg.innerHTML = html;
}

/* ---------- Panels ---------- */
function showDist() {
  const d = pos > 0 ? steps[pos - 1].dist : Array(names.length).fill(0);
  const prev = pos > 1 ? steps[pos - 2].dist : Array(names.length).fill(0);
  $("dist").tBodies[0].innerHTML = names.map((n, i) =>
    `<tr class="${d[i] !== prev[i] ? "changed" : ""}"><td>${n}</td><td>${d[i].toFixed(5)}</td><td>×${Math.exp(-d[i]).toFixed(5)}</td></tr>`).join("");
}
function showLog() {
  if (pos === 0) { $("log").textContent = "Ready. Every distance starts at 0. Press Step or Play."; return; }
  const s = steps[pos - 1], e = edges[s.i];
  $("log").innerHTML = `<b>${s.phase}</b>: checking ${e.label} (rate ${e.rate.toPrecision(6)}, weight ${e.w.toFixed(5)}). ` +
    (s.detected ? "This edge can still be relaxed, so a negative cycle exists." :
     s.relaxed ? `Shorter path found, so dist[${names[e.v]}] is updated.` : "No improvement.");
}
function showResult() {
  const box = $("result");
  if (pos < steps.length) { box.textContent = "Simulation in progress…"; return; }
  if (!cycle) { box.innerHTML = `<span class="lose">No arbitrage found.</span><br>No loop of trades returns more than you start with.`; return; }
  const mult = cycle.reduce((p, i) => p * edges[i].rate, 1);
  const loop = [...cycle.map(i => names[edges[i].u]), names[edges[cycle[0]].u]].join(" → ");
  box.innerHTML = `<span class="win">Arbitrage detected</span><br>Loop: <b>${loop}</b><br>Profit per cycle: <b>${((mult - 1) * 100).toFixed(4)}%</b>` +
    `<label for="amt" style="margin-top:12px">Starting amount in ${names[edges[cycle[0]].u]}</label><input id="amt" type="number" value="1000" min="0"><ol id="trades"></ol>`;
  const calc = () => {
    let amt = parseFloat($("amt").value) || 0, out = "";
    cycle.forEach(i => {
      const e = edges[i], next = amt * e.rate;
      out += `<li>${amt.toFixed(2)} ${names[e.u]} → ${next.toFixed(2)} ${names[e.v]}</li>`; amt = next;
    });
    $("trades").innerHTML = out + `<li><b>Net gain: ${(amt - (parseFloat($("amt").value) || 0)).toFixed(2)}</b></li>`;
  };
  $("amt").oninput = calc; calc();
}
function refresh() {
  draw(); showDist(); showLog(); showResult();
  const done = pos >= steps.length;
  $("step").disabled = $("finish").disabled = done;
  $("play").disabled = done && !timer;
  $("reset").disabled = false;
}

/* ---------- Controls ---------- */
function stop() { clearInterval(timer); timer = null; $("play").textContent = "Play"; }
function next() { if (pos < steps.length) pos++; if (pos >= steps.length) stop(); refresh(); }
function start() {
  try {
    ({ names, edges } = readInput());
  } catch (err) { $("msg").textContent = err; return; }
  $("msg").textContent = "";
  stop();
  ({ steps, cycle } = bellmanFord(names.length, edges));
  pos = 0; layout(); refresh();
}
$("build").onclick = start;
$("step").onclick = () => { stop(); next(); };
$("finish").onclick = () => { stop(); pos = steps.length; refresh(); };
$("reset").onclick = () => { stop(); pos = 0; refresh(); };
$("play").onclick = () => {
  if (timer) { stop(); return; }
  if (pos >= steps.length) return;
  $("play").textContent = "Pause";
  timer = setInterval(next, +$("speed").value);
};
$("speed").oninput = () => { if (timer) { clearInterval(timer); timer = setInterval(next, +$("speed").value); } };
$("addPair").onclick = () => addRow();
$("loadPreset").onclick = () => { loadPreset($("preset").value); start(); };

loadPreset("arb");
start();
