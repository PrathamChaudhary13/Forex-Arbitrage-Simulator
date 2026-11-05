"use strict";
const $ = id => document.getElementById(id);
const COINS = [{ id: "bitcoin", s: "BTC" }, { id: "ethereum", s: "ETH" }, { id: "ripple", s: "XRP" }, { id: "litecoin", s: "LTC" }];
const EXCHANGES = ["binance", "kraken", "gdax", "bitstamp", "bitfinex"];
let cache = null; // last fetched data for the current mode

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${new URL(url).host} answered ${r.status}`);
  return r.json();
}

/* ---------- Fetching ---------- */
async function fetchForex() {
  const codes = [...new Set($("cur").value.toUpperCase().split(/\s+/).filter(Boolean))];
  if (codes.length < 3 || codes.length > 8) throw new Error("Enter between 3 and 8 currency codes.");
  const others = codes.slice(1).join(",");
  const urls = [`https://api.frankfurter.dev/v1/latest?base=${codes[0]}&symbols=${others}`,
                `https://api.frankfurter.app/latest?from=${codes[0]}&to=${others}`];
  let data, lastErr;
  for (const u of urls) { try { data = await getJSON(u); if (data.rates) break; } catch (e) { lastErr = e; } }
  if (!data || !data.rates) throw lastErr || new Error("Frankfurter returned no rates.");
  const r = [1, ...codes.slice(1).map(c => data.rates[c])];
  if (r.some(x => !(x > 0))) throw new Error("Some currency codes are not supported by the API.");
  const mid = r.map((_, i) => r.map((__, j) => r[j] / r[i]));  // i -> j
  return { names: codes, mid, info: `Frankfurter (European Central Bank reference rates), dated ${data.date}` };
}
async function fetchCrypto() {
  const ids = COINS.map(c => c.id).join(","), vs = COINS.map(c => c.s.toLowerCase()).join(",");
  const d = await getJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${vs}`);
  const mid = COINS.map(a => COINS.map(b => a.id === b.id ? 1 : d[a.id] && d[a.id][b.s.toLowerCase()]));
  if (mid.some(row => row.some(x => !(x > 0)))) throw new Error("CoinGecko did not return every pair (rate limit?). Wait a minute and retry.");
  return { names: COINS.map(c => c.s), mid, info: `CoinGecko, fetched ${new Date().toLocaleTimeString()}` };
}
async function fetchCross() {
  const d = await getJSON(`https://api.coingecko.com/api/v3/coins/bitcoin/tickers?exchange_ids=${EXCHANGES.join(",")}`);
  const best = {};
  (d.tickers || []).forEach(t => {
    if (t.base === "BTC" && (t.target === "USD" || t.target === "USDT") && t.last > 0 && !best[t.market.identifier])
      best[t.market.identifier] = { name: t.market.name, quote: t.target, price: t.last };
  });
  const rows = Object.values(best);
  if (rows.length < 2) throw new Error("Fewer than two exchanges returned a BTC/USD price.");
  return { rows, info: `CoinGecko tickers, fetched ${new Date().toLocaleTimeString()}` };
}

/* ---------- Analysis ---------- */
function closestLoop(n, R) {            // best product over all 3- and 4-currency loops
  let best = { p: 0, path: [] };
  const tryPath = path => {
    let p = 1;
    for (let k = 0; k < path.length; k++) p *= R[path[k]][path[(k + 1) % path.length]];
    if (p > best.p) best = { p, path: path.slice() };
  };
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (b !== a)
    for (let c = 0; c < n; c++) if (c !== a && c !== b) {
      tryPath([a, b, c]);
      for (let d = 0; d < n; d++) if (d !== a && d !== b && d !== c) tryPath([a, b, c, d]);
    }
  return best;
}
function analyzeGraph() {
  const { names, mid } = cache, n = names.length;
  const fee = (+$("fee").value || 0) / 100, nz = (+$("noise").value || 0) / 100;
  const R = mid.map((row, i) => row.map((m, j) => i === j ? 1 : m * (1 - fee) * (1 + (Math.random() * 2 - 1) * nz)));
  const edges = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j)
    edges.push({ u: i, v: j, rate: R[i][j], w: -Math.log(R[i][j]), label: `${names[i]}→${names[j]}` });
  const { cycle } = bellmanFord(n, edges);

  let path, prod, found = !!cycle;
  if (found) { path = cycle.map(i => edges[i].u); prod = cycle.reduce((p, i) => p * edges[i].rate, 1); }
  else { const b = closestLoop(n, R); path = b.path; prod = b.p; }

  // matrix
  const hit = new Set(found ? cycle.map(i => `${edges[i].u},${edges[i].v}`) : []);
  $("matrix").innerHTML = `<tr><th>from \\ to</th>${names.map(x => `<th>${x}</th>`).join("")}</tr>` +
    R.map((row, i) => `<tr><th>${names[i]}</th>${row.map((x, j) => `<td class="${hit.has(i + "," + j) ? "hit" : ""}">${i === j ? "–" : x.toPrecision(6)}</td>`).join("")}</tr>`).join("");

  const loopTxt = [...path, path[0]].map(i => names[i]).join(" → ");
  const v = $("verdict");
  v.className = "verdict " + (found ? "yes" : "no");
  v.innerHTML = found
    ? `Arbitrage found<br><span style="font-size:15px;font-weight:600">${loopTxt}<br>Profit per loop: ${((prod - 1) * 100).toFixed(4)}% after ${(fee * 100).toFixed(2)}% fee per trade</span>`
    : `No arbitrage<br><span style="font-size:15px;font-weight:600;color:var(--muted)">Closest loop: ${loopTxt}<br>returns ${prod.toFixed(6)}× (${((prod - 1) * 100).toFixed(4)}%)</span>`;

  let amt = 1000, out = "";
  path.forEach((u, k) => {
    const w = path[(k + 1) % path.length], next = amt * R[u][w];
    out += `<li>${amt.toFixed(2)} ${names[u]} → ${next.toFixed(2)} ${names[w]}</li>`; amt = next;
  });
  $("trades").innerHTML = out;
  drawLoop(names, path, R, found);
}
function analyzeCross() {
  const fee = (+$("fee").value || 0) / 100, rows = cache.rows.slice().sort((a, b) => a.price - b.price);
  const lo = rows[0], hi = rows[rows.length - 1];
  const gross = hi.price / lo.price, net = gross * (1 - fee) * (1 - fee);
  $("matrix").innerHTML = `<tr><th>Exchange</th><th>Quote</th><th>BTC price</th></tr>` +
    rows.map(r => `<tr><th>${r.name}</th><td>${r.quote}</td><td class="${r === lo || r === hi ? "hit" : ""}">${r.price.toLocaleString()}</td></tr>`).join("");
  const win = net > 1, v = $("verdict");
  v.className = "verdict " + (win ? "yes" : "no");
  v.innerHTML = (win ? "Spread beats fees" : "No profitable spread") +
    `<br><span style="font-size:15px;font-weight:600">Buy on ${lo.name}, sell on ${hi.name}<br>Gross ${((gross - 1) * 100).toFixed(3)}%, net ${((net - 1) * 100).toFixed(3)}% after two trades</span>`;
  $("trades").innerHTML = `<li>Buy 1 BTC on ${lo.name} for ${lo.price.toLocaleString()}</li><li>Sell it on ${hi.name} for ${hi.price.toLocaleString()}</li>`;
  $("loop").innerHTML = "";
}

/* ---------- Drawing the loop ---------- */
function drawLoop(names, path, R, found) {
  const k = path.length, col = found ? "var(--red)" : "var(--muted)";
  const P = path.map((_, i) => { const a = -Math.PI / 2 + 2 * Math.PI * i / k; return { x: 200 + 105 * Math.cos(a), y: 150 + 105 * Math.sin(a) }; });
  let s = "";
  for (let i = 0; i < k; i++) {
    const a = P[i], b = P[(i + 1) % k], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const sx = a.x + ux * 26, sy = a.y + uy * 26, tx = b.x - ux * 28, ty = b.y - uy * 28, bx = tx - ux * 11, by = ty - uy * 11;
    const mx = (sx + tx) / 2 + (200 - (a.x + b.x) / 2) * -0.18, my = (sy + ty) / 2 + (150 - (a.y + b.y) / 2) * -0.18;
    s += `<line x1="${sx}" y1="${sy}" x2="${bx}" y2="${by}" stroke="${col}" stroke-width="3"/>` +
         `<polygon points="${tx},${ty} ${bx - uy * 7},${by + ux * 7} ${bx + uy * 7},${by - ux * 7}" fill="${col}"/>` +
         `<text x="${mx}" y="${my}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)">${R[path[i]][path[(i + 1) % k]].toPrecision(5)}</text>`;
  }
  P.forEach((p, i) => s += `<circle cx="${p.x}" cy="${p.y}" r="24" fill="var(--panel)" stroke="${col}" stroke-width="2"/>` +
    `<text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="700" fill="var(--ink)">${names[path[i]]}</text>`);
  $("loop").innerHTML = s;
}

/* ---------- Wiring ---------- */
const analyze = () => (cache.rows ? analyzeCross() : analyzeGraph());
async function load() {
  const mode = $("mode").value, btn = $("fetch");
  btn.disabled = true; btn.textContent = "Fetching…"; $("msg").textContent = "";
  try {
    cache = await (mode === "forex" ? fetchForex : mode === "crypto" ? fetchCrypto : fetchCross)();
    $("status").textContent = "Source: " + cache.info;
    $("rerun").disabled = false;
    analyze();
  } catch (e) {
    $("msg").textContent = `Could not fetch rates: ${e.message}. Check your internet connection, or wait a minute if you hit the free rate limit.`;
  }
  btn.disabled = false; btn.textContent = "Fetch live rates";
}
$("fetch").onclick = load;
$("rerun").onclick = () => cache && analyze();
$("mode").onchange = () => {
  const m = $("mode").value;
  $("curBox").style.display = m === "forex" ? "" : "none";
  $("noiseBox").style.display = m === "cross" ? "none" : "";
  cache = null; $("rerun").disabled = true; $("status").textContent = "No data yet.";
};
