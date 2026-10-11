/* Bootstrap: load data, then run a hash-based tab router. Each view's charts
   are initialized lazily the first time the tab is opened (ECharts cannot
   size itself inside a hidden container) and resized on later visits. */

const DATA = {};
const viewCharts = {};
const VERSION = 4;          // bump with every release: the host caches hard

async function loadJSON(name) {
  const res = await fetch("data/" + name + "?v=" + VERSION);
  if (!res.ok) throw new Error("failed to load " + name);
  return res.json();
}

/* The lede of the 2050 view takes its numbers from the data. */
function ledes() {
  const t = DATA.meta.treemap_summary;
  document.getElementById("future-lede").textContent =
    "Tiles are sized by projected 2050 municipal waste and colored by current EPR " +
    `status. ${M.num(t.share_2050_no_binding, 1)}% of that waste will arise in countries ` +
    `without binding EPR today, and ${M.num(t.top5_no_binding_share_of_nb, 1)}% of it in ` +
    `five countries (${t.top5_no_binding.join(", ")}).`;
}

const EVIDENCE_NOTES = {
  gradient: "Locally weighted fits with bootstrap bands; the curves cross near a governance score of .4. Points are countries.",
  marginal: "Marginal association of EPR presence with the recycling share, from the interaction model (n = 119, HC3 standard errors).",
  specs: "400 alternative specifications; the estimate is positive in all of them and clearly significant in 37%. Filled points: p < .05.",
  gate: "Segmented fit across 54 countries; the break near 96% coverage carries a bootstrap interval of 91 to 99 (shaded). The break describes the sample and is not a threshold.",
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
  overview: () => [initStory(DATA)],
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
  activate((location.hash || "#overview").slice(1));
}

async function main() {
  const [countries, curves, treemap, specs, meta, story, geojson] = await Promise.all([
    loadJSON("countries.json"), loadJSON("curves.json"), loadJSON("treemap.json"),
    loadJSON("specs.json"), loadJSON("meta.json"), loadJSON("story.json"),
    loadJSON("world.geojson"),
  ]);
  Object.assign(DATA, { countries, curves, treemap, specs, meta, story, geojson });
  echarts.registerMap("world", geojson);

  ledes();
  /* the logo leads to the main page: the address without a hash */
  document.getElementById("brand").addEventListener("click", (e) => {
    e.preventDefault();
    history.pushState(null, "", location.pathname + location.search);
    router();
  });
  window.addEventListener("popstate", router);
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
