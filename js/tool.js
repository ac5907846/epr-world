/* EPR readiness check: for a selected country, show the two enabling
   conditions (governance, collection) and the model-implied EPR margin,
   plus a peer chart placing the country on the governance curve. */

function initTool(DATA) {
  const sel = document.getElementById("tool-country");
  const entries = Object.entries(DATA.countries)
    .filter(([, c]) => c.governance != null)
    .sort((a, b) => a[1].name.localeCompare(b[1].name));
  for (const [iso, c] of entries) {
    const o = document.createElement("option");
    o.value = iso; o.textContent = c.name;
    sel.appendChild(o);
  }
  const ch = echarts.init(document.getElementById("chart-tool"));

  function margin(gov) {
    return DATA.meta.model.epr + DATA.meta.model.inter * gov;
  }

  function render(iso) {
    const c = DATA.countries[iso];
    const m = margin(c.governance);
    const gate = DATA.meta.gate_break;
    const cards = [];

    const govClass = c.governance > .3 ? "ok" : c.governance > -.3 ? "warn" : "bad";
    cards.push(`<div class="tool-card ${govClass}">
      <div class="big">${c.governance.toFixed(2)}</div>
      Governance (WGI composite). The EPR margin turns positive above about .3.
      </div>`);

    if (c.collection == null) {
      cards.push(`<div class="tool-card warn"><div class="big">no data</div>
        Collection coverage is unreported; the study finds recycling responds
        only once coverage nears ${gate}%.</div>`);
    } else {
      const colClass = c.collection >= gate ? "ok" :
                       c.collection >= 80 ? "warn" : "bad";
      cards.push(`<div class="tool-card ${colClass}">
        <div class="big">${c.collection.toFixed(0)}%</div>
        Collection coverage, against the ${gate}% gate the study identifies.</div>`);
    }

    const mClass = m > 2 ? "ok" : m > -2 ? "warn" : "bad";
    cards.push(`<div class="tool-card ${mClass}">
      <div class="big">${m > 0 ? "+" : ""}${m.toFixed(1)} pp</div>
      Model-implied recycling margin of having EPR at this governance level
      (association, not a causal effect).</div>`);

    const statusLine = c.epr
      ? `${c.name} already operates EPR (${c.status}).`
      : `${c.name} has no EPR scheme in the inventory.`;
    cards.push(`<div class="tool-card"><div>${statusLine}</div></div>`);
    document.getElementById("tool-cards").innerHTML = cards.join("");

    const mc = DATA.curves.marginal;
    ch.setOption({
      grid: { left: 60, right: 30, top: 30, bottom: 45 },
      tooltip: { show: false },
      xAxis: { name: "Governance (WGI)", nameLocation: "middle", nameGap: 28,
        axisLine: { lineStyle: { color: "#c9cdd8" } }, axisTick: { show: false },
        axisLabel: { color: "#494e5c" }, splitLine: { show: false } },
      yAxis: { name: "EPR margin (pp of recycling)", nameLocation: "middle",
        nameGap: 40, axisLine: { lineStyle: { color: "#c9cdd8" } },
        axisTick: { show: false }, axisLabel: { color: "#494e5c" },
        splitLine: { lineStyle: { color: "#e9ebf1" } } },
      series: [
        ...bandSeries(mc.governance, mc.lo, mc.hi, "#1b56ad"),
        { type: "line", data: mc.governance.map((v, i) => [v, mc.effect[i]]),
          symbol: "none", lineStyle: { color: "#1b56ad", width: 3 },
          markLine: { silent: true, symbol: "none",
            lineStyle: { color: "#c9cdd8" }, data: [{ yAxis: 0 }],
            label: { show: false } } },
        { type: "scatter", data: [[c.governance, margin(c.governance)]],
          symbolSize: 14, itemStyle: { color: "#d98e12" },
          label: { show: true, formatter: c.name, position: "top",
            color: "#1c1e26", fontWeight: 600 } },
      ],
    }, { notMerge: true });
  }

  sel.addEventListener("change", () => render(sel.value));
  sel.value = "VNM" in DATA.countries ? "VNM" : entries[0][0];
  render(sel.value);
  return ch;
}
