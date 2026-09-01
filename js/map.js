/* World map with three coloring modes and a country detail card. */

function buildMap(DATA, geojson) {
  echarts.registerMap("world", geojson);
  const ch = echarts.init(document.getElementById("chart-map"));

  const STATUS_VAL = { "Law in force": 3, "Policy approved": 2,
                       "Draft or planning": 1, "No EPR scheme": 0 };

  function seriesData(mode) {
    return Object.entries(DATA.countries).map(([iso, c]) => {
      let v = null;
      if (mode === "status") v = STATUS_VAL[c.status] ?? null;
      if (mode === "recycling") v = c.recycling;
      if (mode === "governance") v = c.governance;
      return { name: iso, value: v == null ? NaN : v };
    });
  }

  const VISUAL = {
    status: { type: "piecewise", pieces: [
        { value: 3, label: "Law in force", color: "#1b56ad" },
        { value: 2, label: "Policy approved", color: "#6f9bd6" },
        { value: 1, label: "Draft or planning", color: "#bdd2ec" },
        { value: 0, label: "No EPR scheme", color: "#d5d9e4" },
      ], left: 10, bottom: 10, textStyle: { color: "#494e5c" } },
    recycling: { type: "continuous", min: 0, max: 45, text: ["45%+", "0%"],
      inRange: { color: ["#f3f9f5", "#98ccab", "#0e7a43", "#07472a"] },
      left: 10, bottom: 10, textStyle: { color: "#494e5c" } },
    governance: { type: "continuous", min: -2, max: 2, text: ["strong", "weak"],
      inRange: { color: ["#f4f7fb", "#9bbde5", "#1b56ad", "#0d2f63"] },
      left: 10, bottom: 10, textStyle: { color: "#494e5c" } },
  };

  function render(mode) {
    ch.setOption({
      tooltip: { formatter: (p) => {
        const c = DATA.countries[p.name];
        if (!c) return p.name;
        const parts = [`<b>${c.name}</b>`, c.status || "no data"];
        if (c.recycling != null) parts.push(`recycling ${c.recycling.toFixed(1)}%`);
        if (c.governance != null) parts.push(`governance ${c.governance.toFixed(2)}`);
        return parts.join("<br>");
      } },
      visualMap: VISUAL[mode],
      series: [{ type: "map", map: "world", nameProperty: "iso3c",
        roam: true, scaleLimit: { min: 1, max: 6 },
        itemStyle: { areaColor: "#f3f4f8", borderColor: "#fff", borderWidth: .6 },
        emphasis: { label: { show: false },
          itemStyle: { areaColor: "#d98e12" } },
        select: { disabled: true },
        data: seriesData(mode) }],
    }, { notMerge: true });
  }

  ch.on("click", (p) => showCountry(DATA, p.name));
  render("status");

  document.querySelectorAll("#map-modes button").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll("#map-modes button").forEach((x) =>
        x.classList.remove("active"));
      b.classList.add("active");
      render(b.dataset.mode);
    });
  });
  return ch;
}

function fmt(v, suffix = "", dec = 1) {
  return v == null || Number.isNaN(v) ? "no data" : (+v).toFixed(dec) + suffix;
}

function showCountry(DATA, iso) {
  const c = DATA.countries[iso];
  const el = document.getElementById("country-card");
  if (!c) { el.innerHTML = "<p class='hint'>No profile for this territory.</p>"; return; }
  const pillColor = { "Law in force": "#1b56ad", "Policy approved": "#6f9bd6",
    "Draft or planning": "#8fa8c8", "No EPR scheme": "#818697" }[c.status] || "#818697";
  const streams = Object.entries(c.streams).map(([k, v]) =>
    `<span class="${v ? "" : "off"}">${k}</span>`).join("");
  el.innerHTML = `
    <h3>${c.name}</h3>
    <span class="status-pill" style="background:${pillColor}">${c.status || "no data"}</span>
    <dl>
      <dt>Income group</dt><dd>${c.income || "n/a"}</dd>
      <dt>Recycling</dt><dd>${fmt(c.recycling, "%")}</dd>
      <dt>Open dumping</dt><dd>${fmt(c.open_dump, "%")}</dd>
      <dt>Collection</dt><dd>${fmt(c.collection, "%", 0)}</dd>
      <dt>Governance</dt><dd>${fmt(c.governance, "", 2)}</dd>
      <dt>MSW per capita</dt><dd>${fmt(c.msw_kg_cap_day, " kg/day", 2)}</dd>
      <dt>Scheme</dt><dd>${c.mandatory && c.mandatory !== "nan" ? c.mandatory : "n/a"}</dd>
    </dl>
    <div class="streams">${streams}</div>`;
}
