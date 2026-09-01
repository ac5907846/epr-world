/* Chart builders. Every function receives the shared DATA object and a DOM id,
   returns an initialized ECharts instance. */

const C = {
  petrol: "#1b56ad", petrolMid: "#6f9bd6", petrolLight: "#bdd2ec",
  olive: "#0e7a43", clay: "#d98e12", bad: "#a92433",
  ink: "#1c1e26", ink2: "#494e5c", ink3: "#818697",
  rule: "#c9cdd8", grid: "#e9ebf1", wash: "#f3f4f8",
};
const STATUS_COLORS = {
  "Law in force": C.petrol,
  "Policy approved": C.petrolMid,
  "Draft or planning": C.petrolLight,
  "No EPR scheme": "#d5d9e4",
};
const AXIS = {
  axisLine: { lineStyle: { color: C.rule } },
  axisTick: { show: false },
  axisLabel: { color: C.ink2 },
  splitLine: { lineStyle: { color: C.grid } },
};

function baseGrid() {
  return { left: 60, right: 30, top: 40, bottom: 45 };
}

function bandSeries(x, lo, hi, color) {
  /* Confidence band drawn as one explicit polygon: robust on any axis. */
  const pts = [];
  for (let i = 0; i < x.length; i++) {
    if (x[i] != null && lo[i] != null && hi[i] != null) pts.push(i);
  }
  pts.sort((a, b) => x[a] - x[b]);
  const ring = pts.map((i) => [x[i], lo[i]])
    .concat(pts.slice().reverse().map((i) => [x[i], hi[i]]));
  return [{
    type: "custom", silent: true, z: 1, tooltip: { show: false },
    renderItem: (params, api) => {
      if (params.dataIndex !== 0) return null;
      return { type: "polygon",
        shape: { points: ring.map((p) => api.coord(p)) },
        style: { fill: color, opacity: .15 } };
    },
    data: [0],
  }];
}

function chartGradient(DATA, el) {
  const ch = echarts.init(document.getElementById(el));
  const cs = Object.values(DATA.countries).filter(
    (c) => c.governance != null && c.recycling != null);
  const pts = (flag) => cs.filter((c) => c.epr === flag)
    .map((c) => ({ value: [c.governance, c.recycling], name: c.name }));
  const lw = DATA.curves.lowess_epr, ln = DATA.curves.lowess_none;
  ch.setOption({
    grid: baseGrid(),
    tooltip: { formatter: (p) => p.name ? `${p.name}<br>governance ${p.value[0].toFixed(2)}, recycling ${p.value[1].toFixed(1)}%` : "" },
    xAxis: { name: "Governance (WGI)", min: -2, max: 2.2,
             nameLocation: "middle", nameGap: 28, ...AXIS },
    yAxis: { name: "Recycling (% of MSW)", min: -5, max: 60,
             nameLocation: "middle", nameGap: 40, ...AXIS },
    legend: { top: 4, data: ["EPR present", "No EPR"] },
    series: [
      ...bandSeries(lw.x, lw.lo, lw.hi, C.petrol),
      ...bandSeries(ln.x, ln.lo, ln.hi, C.ink3),
      { name: "EPR present", type: "scatter", data: pts(1), symbolSize: 7,
        itemStyle: { color: C.petrol, opacity: .75 } },
      { name: "No EPR", type: "scatter", data: pts(0), symbolSize: 7,
        itemStyle: { color: "#fff", borderColor: C.ink3, borderWidth: 1.2 } },
      { type: "line", data: lw.x.map((v, i) => [v, lw.fit[i]]), symbol: "none",
        lineStyle: { color: C.petrol, width: 3 }, tooltip: { show: false } },
      { type: "line", data: ln.x.map((v, i) => [v, ln.fit[i]]), symbol: "none",
        lineStyle: { color: C.ink3, width: 2.5, type: "dashed" }, tooltip: { show: false } },
    ],
  });
  return ch;
}

function chartMarginal(DATA, el) {
  const ch = echarts.init(document.getElementById(el));
  const m = DATA.curves.marginal;
  ch.setOption({
    grid: baseGrid(),
    tooltip: { trigger: "axis", formatter: (ps) => {
      const p = ps.find((q) => q.seriesName === "EPR margin");
      return p ? `governance ${(+p.value[0]).toFixed(2)}<br>EPR margin ${(+p.value[1]).toFixed(1)} pp` : "";
    } },
    xAxis: { name: "Governance (WGI)", nameLocation: "middle", nameGap: 28, ...AXIS },
    yAxis: { name: "EPR association with recycling (pp)", nameLocation: "middle", nameGap: 42, ...AXIS },
    series: [
      ...bandSeries(m.governance, m.lo, m.hi, C.petrol),
      { name: "EPR margin", type: "line",
        data: m.governance.map((v, i) => [v, m.effect[i]]), symbol: "none",
        lineStyle: { color: C.petrol, width: 3 },
        markLine: { silent: true, symbol: "none",
          lineStyle: { color: C.rule, type: "solid" },
          data: [{ yAxis: 0 }], label: { show: false } } },
    ],
  });
  return ch;
}

function chartSpecs(DATA, el) {
  const ch = echarts.init(document.getElementById(el));
  const s = DATA.specs;
  const idx = s.coef.map((_, i) => i);
  ch.setOption({
    grid: baseGrid(),
    tooltip: { formatter: (p) => {
      const i = p.dataIndex;
      return `spec ${i + 1} of ${s.coef.length}<br>coefficient ${s.coef[i].toFixed(2)}` +
        `<br>${s.epr_var[i]} EPR, ${s.gov_var[i].replaceAll("_", " ")}, sample: ${s.sample[i].replaceAll("_", " ")}`;
    } },
    xAxis: { name: "Specifications, sorted by coefficient", nameLocation: "middle",
             nameGap: 28, ...AXIS },
    yAxis: { name: "EPR x governance interaction", nameLocation: "middle", nameGap: 40, ...AXIS },
    series: [
      { type: "custom", silent: true,
        renderItem: (params, api) => ({
          type: "line",
          shape: { x1: api.coord([api.value(0), api.value(1)])[0],
                   y1: api.coord([api.value(0), api.value(1)])[1],
                   x2: api.coord([api.value(0), api.value(2)])[0],
                   y2: api.coord([api.value(0), api.value(2)])[1] },
          style: { stroke: C.grid, lineWidth: 1 } }),
        data: idx.map((i) => [i, s.lo[i], s.hi[i]]) },
      { type: "scatter", data: idx.map((i) => [i, s.coef[i]]), symbolSize: 4,
        itemStyle: { color: (p) => (s.sig[p.dataIndex] ? C.petrol : "#c3c8d4") } },
      { type: "line", data: [[0, 0], [s.coef.length - 1, 0]], symbol: "none",
        silent: true, lineStyle: { color: C.rule } },
    ],
  });
  return ch;
}

function chartGate(DATA, el) {
  const ch = echarts.init(document.getElementById(el));
  const g = DATA.curves.gate_scatter, f = DATA.curves.gate_fit,
        meta = DATA.curves.gate_meta;
  const pts = g.collection_pct.map((v, i) => ({
    value: [v, g.recycling_pct[i]],
    name: g.country ? g.country[i] : "",
    epr: g.epr_present ? g.epr_present[i] : null }));
  ch.setOption({
    grid: baseGrid(),
    tooltip: { formatter: (p) => p.name ? `${p.name}<br>collection ${p.value[0].toFixed(0)}%, recycling ${p.value[1].toFixed(1)}%` : "" },
    xAxis: { name: "Collection coverage (% of population)", nameLocation: "middle", nameGap: 28, ...AXIS },
    yAxis: { name: "Recycling (% of MSW)", nameLocation: "middle", nameGap: 40, ...AXIS },
    series: [
      { type: "scatter", data: pts, symbolSize: 8,
        itemStyle: { color: (p) => (pts[p.dataIndex].epr ? C.petrol : "#fff"),
          borderColor: C.ink3,
          borderWidth: (p) => (pts[p.dataIndex].epr ? 0 : 1.2), opacity: .8 } },
      { type: "line", data: f.collection_pct.map((v, i) => [v, f.recycling_hat[i]]),
        symbol: "none", lineStyle: { color: C.olive, width: 3 }, tooltip: { show: false },
        markArea: { silent: true, itemStyle: { color: C.olive, opacity: .07 },
          data: [[{ xAxis: meta.break_ci_lo }, { xAxis: meta.break_ci_hi }]] },
        markLine: { silent: true, symbol: "none",
          lineStyle: { color: C.olive, type: "dashed" },
          data: [{ xAxis: meta.break_pct }],
          label: { formatter: `gate near ${meta.break_pct}%`, color: C.olive } } },
    ],
  });
  return ch;
}

function chartComposition(DATA, el) {
  const ch = echarts.init(document.getElementById(el));
  const b = DATA.curves.composition;
  const bands = [
    ["organics", "Organics", "#67b389"],
    ["paper", "Paper and cardboard", "#a4a9b8"],
    ["plastic", "Plastic", C.petrol],
    ["glass_metal", "Glass and metal", C.petrolMid],
    ["bulky_other_mat", "Textiles, wood, rubber", "#d4b483"],
    ["residual", "Other and residual", "#e3e6ee"],
  ];
  /* Manual cumulative stacking: keep only rows where every band is present
     and x is ascending, then draw cumulative areas back to front. */
  const rows = [];
  for (let i = 0; i < b.gdp_pc.length; i++) {
    if (bands.every(([k]) => b[k][i] != null && !Number.isNaN(b[k][i]))) {
      rows.push(i);
    }
  }
  rows.sort((i, j) => b.gdp_pc[i] - b.gdp_pc[j]);
  const cum = rows.map((i) => {
    let acc = 0;
    const levels = bands.map(([k]) => (acc += b[k][i]));
    return { x: b.gdp_pc[i], levels, raw: bands.map(([k]) => b[k][i]) };
  });
  const series = bands.map(([key, name, color], bi) => ({
    name, type: "line", symbol: "none", z: bands.length - bi,
    data: cum.map((r) => [r.x, r.levels[bi]]),
    lineStyle: { width: 0 },
    itemStyle: { color },
    areaStyle: { color, opacity: 1, origin: "start" },
  })).reverse();
  ch.setOption({
    grid: baseGrid(),
    tooltip: { trigger: "axis",
      formatter: (ps) => {
        const idx = ps[0].dataIndex;
        const r = cum[idx];
        return `GDP pc ~$${Math.round(r.x).toLocaleString()}<br>` +
          bands.map(([, name, color], bi) =>
            `<span style="color:${color}">&#9632;</span> ${name}: ${r.raw[bi].toFixed(1)}%`)
          .join("<br>");
      } },
    legend: { top: 2, textStyle: { color: C.ink2 }, data: bands.map(([, n]) => n) },
    xAxis: { type: "log", name: "GDP per capita (USD, log scale)",
             min: 400, max: 130000, nameLocation: "middle", nameGap: 28, ...AXIS },
    yAxis: { max: 100, name: "Share of MSW (%)", nameLocation: "middle", nameGap: 38, ...AXIS },
    series,
  });
  return ch;
}

function chartTreemap(DATA, el) {
  const ch = echarts.init(document.getElementById(el));
  const tiles = DATA.treemap.tiles.map((t) => ({
    name: t.country, value: t.msw_2050_t,
    itemStyle: { color: STATUS_COLORS[t.status_cat] || "#d5d9e4" },
    status: t.status_cat,
  }));
  ch.setOption({
    tooltip: { formatter: (p) =>
      `${p.name}<br>${(p.value / 1e6).toFixed(1)} Mt projected in 2050<br>${p.data.status}` },
    series: [{ type: "treemap", roam: false, nodeClick: false,
      breadcrumb: { show: false }, data: tiles,
      label: { color: "#fff", fontSize: 11,
        formatter: (p) => (p.value > 2.2e7 ? p.name : "") },
      itemStyle: { borderColor: "#fff", borderWidth: 1.5, gapWidth: 1.5 } }],
  });
  return ch;
}

function chartShares(DATA, el) {
  const ch = echarts.init(document.getElementById(el));
  const order = ["Law in force", "Policy approved", "Draft or planning", "No EPR scheme"];
  const years = [...new Set(DATA.treemap.shares.map((s) => s.year))].sort();
  ch.setOption({
    grid: { left: 60, right: 120, top: 10, bottom: 25 },
    tooltip: { formatter: (p) => `${p.seriesName}: ${p.value}% of world MSW` },
    legend: { orient: "vertical", right: 0, top: "middle",
      textStyle: { fontSize: 11, color: C.ink2 } },
    xAxis: { max: 100, ...AXIS, axisLabel: { formatter: "{value}%" } },
    yAxis: { type: "category", data: years.map(String), ...AXIS },
    series: order.map((st) => ({
      name: st, type: "bar", stack: "s", barWidth: 26,
      itemStyle: { color: STATUS_COLORS[st] },
      data: years.map((y) => {
        const row = DATA.treemap.shares.find((s) => s.year === y && s.status === st);
        return row ? row.share_pct : 0;
      }),
    })),
  });
  return ch;
}

function chartEwaste(DATA, el) {
  const ch = echarts.init(document.getElementById(el));
  const cs = Object.values(DATA.countries).filter(
    (c) => c.ewaste_kg_pc != null && c.gdp_pc != null && c.ewaste_kg_pc > 0);
  const mk = (flag) => cs.filter((c) => (c.streams.WEEE ? 1 : 0) === flag)
    .map((c) => ({ value: [c.gdp_pc, c.ewaste_kg_pc], name: c.name, t: c.ewaste_t }));
  const size = (d) => Math.max(4, Math.sqrt(d.t / 1e6) * 26);
  ch.setOption({
    grid: baseGrid(),
    tooltip: { formatter: (p) => `${p.name}<br>${(+p.value[1]).toFixed(1)} kg per capita, ` +
      `${(p.data.t / 1e6).toFixed(2)} Mt total` },
    legend: { top: 4 },
    xAxis: { type: "log", name: "GDP per capita (USD, log scale)",
             min: 250, max: 150000, nameLocation: "middle", nameGap: 28, ...AXIS },
    yAxis: { type: "log", name: "E-waste (kg per capita, log scale)",
             min: .1, max: 60, nameLocation: "middle", nameGap: 42, ...AXIS },
    series: [
      { name: "WEEE EPR present", type: "scatter", data: mk(1),
        symbolSize: (v, p) => size(p.data),
        itemStyle: { color: C.petrol, opacity: .6 } },
      { name: "No WEEE EPR", type: "scatter", data: mk(0),
        symbolSize: (v, p) => size(p.data),
        itemStyle: { color: "rgba(0,0,0,0)", borderColor: C.bad, borderWidth: 1.6 } },
    ],
  });
  return ch;
}
