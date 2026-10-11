/* World map with three coloring modes and a country card. The map steps
   through the countries by itself, one card after the other, and keeps doing
   so until the reader presses Pause or clicks inside the map. */

function buildMap(DATA, geojson) {
  echarts.registerMap("world", geojson);
  const el = document.getElementById("chart-map");
  const ch = echarts.init(el);

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
        { value: 3, label: "Binding EPR", color: "#1b56ad" },
        { value: 2, label: "Policy approved", color: "#6eaf8e" },
        { value: 1, label: "Draft or planning", color: "#b7d9c5" },
        { value: 0, label: "No EPR", color: "#d5d9e4" },
      ], left: 10, bottom: 10, textStyle: { color: "#494e5c" } },
    recycling: { type: "continuous", min: 0, max: 45, text: ["45%+", "0%"],
      inRange: { color: ["#f3f9f5", "#98ccab", "#0e7a43", "#07472a"] },
      left: 10, bottom: 10, textStyle: { color: "#494e5c" } },
    governance: { type: "continuous", min: -2, max: 2, text: ["strong", "weak"],
      inRange: { color: ["#f4f7fb", "#9bbde5", "#1b56ad", "#0d2f63"] },
      left: 10, bottom: 10, textStyle: { color: "#494e5c" } },
  };

  let shown = null;                     // the country on the card

  function mark(iso) {
    ch.dispatchAction({ type: "downplay", seriesIndex: 0 });
    if (iso) ch.dispatchAction({ type: "highlight", seriesIndex: 0, name: iso });
  }

  function render(mode) {
    ch.setOption({
      tooltip: { formatter: (p) => {
        const c = DATA.countries[p.name];
        if (!c) return p.name;
        const parts = [`<b>${c.name}</b>`, statusLabel(c.status) || "no data"];
        if (c.recycling != null) parts.push(`recycling ${M.num(c.recycling, 1)}%`);
        if (c.governance != null) parts.push(`governance ${M.num(c.governance, 2)}`);
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
    mark(shown);                        // a new option clears the highlight
  }

  render("status");

  document.querySelectorAll("#map-modes button").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll("#map-modes button").forEach((x) =>
        x.classList.remove("active"));
      b.classList.add("active");
      render(b.dataset.mode);
    });
  });

  /* ---- the tour of the countries ----
     Countries drawn on the map, from the largest projected waste of 2050 to
     the smallest. */
  const view = document.getElementById("view-map");
  const btn = document.getElementById("map-play");
  const drawn = new Set(geojson.features.map((f) => f.properties.iso3c));
  const order = Object.entries(DATA.countries)
    .filter(([iso]) => drawn.has(iso))
    .sort((a, b) => (b[1].msw_2050_t || 0) - (a[1].msw_2050_t || 0))
    .map(([iso]) => iso);
  const STEP_MS = 2600;
  let k = -1, playing = false, t0 = 0, elapsed = 0;

  function select(iso) {
    shown = iso;
    mark(iso);
    showCountry(DATA, iso);
    elapsed = 0;
    t0 = performance.now();
  }
  function tick(now) {
    if (!playing) return;
    /* the clock waits while the page or this view is not shown */
    if (document.hidden || !view.classList.contains("active")) t0 = now - elapsed;
    elapsed = now - t0;
    if (elapsed >= STEP_MS) {
      k = (k + 1) % order.length;
      select(order[k]);
    }
    M.frame(tick);
  }
  function play() {
    if (playing) return;
    playing = true;
    btn.textContent = "Pause";
    t0 = performance.now() - elapsed;
    M.frame(tick);
  }
  function pause() {
    playing = false;
    btn.textContent = "Play";
  }

  btn.addEventListener("click", () => (playing ? pause() : play()));
  /* A click inside the map stops the tour; on a country it shows that
     country, and the tour goes on from there when it is started again. */
  ch.on("click", (p) => {
    if (order.includes(p.name)) k = order.indexOf(p.name);
    select(p.name);
  });
  el.addEventListener("click", pause);
  ch.on("georoam", pause);              // dragging or zooming the map

  k = 0;
  select(order[0]);
  if (!M.reduced) play();
  return ch;
}

function fmt(v, suffix = "", dec = 1) {
  return v == null || Number.isNaN(v) ? "no data" : M.num(+v, dec) + suffix;
}

function showCountry(DATA, iso) {
  const c = DATA.countries[iso];
  const el = document.getElementById("country-card");
  el.classList.remove("in");
  void el.offsetWidth;                  // restart the fade of the card
  el.classList.add("in");
  if (!c) { el.innerHTML = "<p>No profile for this territory.</p>"; return; }
  const pillColor = { "Law in force": "#1b56ad", "Policy approved": "#3f8a63",
    "Draft or planning": "#5d9c7b", "No EPR scheme": "#818697" }[c.status] || "#818697";
  const streams = Object.entries(c.streams).map(([k, v]) =>
    `<span class="${v ? "" : "off"}">${k}</span>`).join("");
  el.innerHTML = `
    <h3>${c.name}</h3>
    <span class="status-pill" style="background:${pillColor}">${statusLabel(c.status) || "no data"}</span>
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
