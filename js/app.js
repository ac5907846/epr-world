/* Bootstrap: load data, then run a hash-based tab router. Each view's charts
   are initialized lazily the first time the tab is opened (ECharts cannot
   size itself inside a hidden container) and resized on later visits. */

const DATA = {};
const viewCharts = {};

async function loadJSON(name) {
  const res = await fetch("data/" + name);
  if (!res.ok) throw new Error("failed to load " + name);
  return res.json();
}

function heroStats() {
  const m = DATA.meta;
  const items = [
    [m.epr_pct + "%", "of 216 countries and economies now have some form of EPR"],
    ["+" + m.interaction.toFixed(1) + " pp", "recycling margin of EPR per unit of governance (p = " + m.interaction_p.toFixed(2) + ")"],
    [m.gate_break + "%", "collection coverage above which recycling takes off"],
    [m.treemap_summary.share_2050_no_binding + "%", "of projected 2050 waste will arise without binding EPR"],
  ];
  document.getElementById("hero-stats").innerHTML = items.map(
    ([num, lbl]) => `<div class="stat"><div class="num">${num}</div>
                     <div class="lbl">${lbl}</div></div>`).join("");
}

const EVIDENCE_NOTES = {
  gradient: "Locally weighted fits with bootstrap bands; the curves cross near a governance score of .4. Points are countries.",
  marginal: "Marginal association of EPR presence with the recycling share, from the interaction model (n = 119, HC3 standard errors).",
  specs: "400 alternative specifications; the estimate is positive in all of them and clearly significant in 37%. Filled points: p < .05.",
  gate: "Segmented fit across 54 countries; the breakpoint near 96% coverage carries a bootstrap interval of 91 to 99 (shaded).",
};

function initEvidence() {
  const builders = { gradient: chartGradient, marginal: chartMarginal,
                     specs: chartSpecs, gate: chartGate };
  let current = null;
  function show(tab) {
    if (current) current.dispose();
    current = builders[tab](DATA, "chart-evidence");
    viewCharts.evidence = [current];
    document.getElementById("evidence-note").textContent = EVIDENCE_NOTES[tab];
  }
  document.querySelectorAll("#evidence-tabs button").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll("#evidence-tabs button").forEach((x) =>
        x.classList.remove("active"));
      b.classList.add("active");
      show(b.dataset.tab);
    });
  });
  show("gradient");
}

/* view name -> lazy initializer returning the charts it created */
const INIT = {
  overview: () => { heroStats(); return []; },
  map: () => [buildMap(DATA, DATA.geojson)],
  evidence: () => { initEvidence(); return viewCharts.evidence; },
  composition: () => [chartComposition(DATA, "chart-composition")],
  future: () => [chartTreemap(DATA, "chart-treemap"),
                 chartShares(DATA, "chart-shares")],
  ewaste: () => [chartEwaste(DATA, "chart-ewaste")],
  tool: () => [initTool(DATA)],
};
const initialized = new Set();

function activate(view) {
  if (!INIT[view]) view = "overview";
  document.querySelectorAll("main .view").forEach((s) =>
    s.classList.toggle("active", s.id === "view-" + view));
  document.querySelectorAll("#tabs a").forEach((a) =>
    a.classList.toggle("active", a.dataset.view === view));
  if (!initialized.has(view)) {
    initialized.add(view);
    viewCharts[view] = INIT[view]() || [];
  } else {
    (viewCharts[view] || []).forEach((c) => c && c.resize());
  }
  window.scrollTo(0, 0);
}

function router() {
  const view = (location.hash || "#overview").slice(1);
  const alias = { overview: "overview", map: "map", evidence: "evidence",
                  composition: "composition", future: "future",
                  ewaste: "ewaste", tool: "tool" };
  activate(alias[view] || "overview");
}

async function main() {
  const [countries, curves, treemap, specs, meta, geojson] = await Promise.all([
    loadJSON("countries.json"), loadJSON("curves.json"), loadJSON("treemap.json"),
    loadJSON("specs.json"), loadJSON("meta.json"), loadJSON("world.geojson"),
  ]);
  Object.assign(DATA, { countries, curves, treemap, specs, meta, geojson });

  window.addEventListener("hashchange", router);
  window.addEventListener("resize", () =>
    Object.values(viewCharts).flat().forEach((c) => c && c.resize()));
  router();
}

main().catch((e) => {
  console.error("[EPRWorld]", e);
  document.body.insertAdjacentHTML("beforeend",
    "<p style='color:#a92433;padding:1rem 4vw'>Data failed to load. " +
    "Serve this folder over HTTP (data files cannot load from file://).</p>");
});
