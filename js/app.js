/* Bootstrap and hash-based tab router.

   The overview must show quickly on any connection, so loading is staged:
     1. the page itself: title and layout are plain HTML and paint at once;
     2. story.json (1 kB): the buttons and the readout of the landing figure;
     3. the chart library, the map and hero.json: the landing chart;
     4. everything the other tabs need, fetched after the landing chart is
        drawn (at once when the page is opened on another tab).
   Each view's charts are created the first time the tab is opened (ECharts
   cannot size itself inside a hidden container) and resized on later visits. */

const DATA = {};
const viewCharts = {};
const VERSION = 9;          // bump with every release: the host caches hard
const ECHARTS = "https://cdnjs.cloudflare.com/ajax/libs/echarts/5.4.3/echarts.min.js";

async function loadJSON(name) {
  const res = await fetch("data/" + name + "?v=" + VERSION);
  if (!res.ok) throw new Error("failed to load " + name);
  return res.json();
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("failed to load " + src));
    document.head.appendChild(s);
  });
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

/* ---- what is loaded, as promises ---- */
const landing = !location.hash || location.hash === "#overview";
const ready = {};
let story = null;                       // the landing figure, once story.json is there

function load() {
  ready.story = loadJSON("story.json").then((s) => {
    DATA.story = s;
    story = prepareStory(s);            // buttons and readout, before any chart
  });
  ready.chart = Promise.all([loadScript(ECHARTS), loadJSON("hero.json"),
                             loadJSON("world.geojson"), ready.story])
    .then(([, hero, geojson]) => {
      Object.assign(DATA, { hero, geojson });
      echarts.registerMap("world", geojson);
    });
  /* the other tabs: after the landing chart is drawn, so that they never
     compete with it for the connection */
  const after = landing ? ready.chart.then(() => new Promise((r) => setTimeout(r, 300)))
                        : Promise.resolve();
  ready.rest = after.then(() => Promise.all([
    loadJSON("countries.json"), loadJSON("curves.json"), loadJSON("treemap.json"),
    loadJSON("specs.json"), loadJSON("meta.json"), loadJSON("sources.json"), ready.chart,
  ])).then(([countries, curves, treemap, specs, meta, sources]) => {
    Object.assign(DATA, { countries, curves, treemap, specs, meta, sources });
    ledes();
  });
}

/* view name -> what it waits for, and the initializer returning its charts */
const INIT = {
  overview: ["chart", () => [story.start(DATA)]],
  map: ["rest", () => [buildMap(DATA, DATA.geojson)]],
  evidence: ["rest", () => { initEvidence(); return viewCharts.evidence; }],
  composition: ["rest", () => [chartComposition(DATA, "chart-composition")]],
  future: ["rest", () => [chartTreemap(DATA, "chart-treemap"),
                          chartShares(DATA, "chart-shares")]],
  ewaste: ["rest", () => [chartEwaste(DATA, "chart-ewaste")]],
  sources: ["rest", () => { initSources(DATA); return []; }],
  tool: ["rest", () => [initTool(DATA)]],
};
const initialized = new Set();
let current = null;

function activate(view) {
  if (!INIT[view]) view = "overview";
  current = view;
  document.querySelectorAll("main .view").forEach((s) =>
    s.classList.toggle("active", s.id === "view-" + view));
  document.querySelectorAll("#tabs a").forEach((a) =>
    a.classList.toggle("active", a.dataset.view === view));
  window.scrollTo(0, 0);
  if (initialized.has(view)) {
    (viewCharts[view] || []).forEach((c) => c && c.resize());
    return;
  }
  const [need, init] = INIT[view];
  ready[need].then(() => {
    /* a chart is created only while its view is shown; if the reader has
       moved on, it is created when the view is opened again */
    if (current !== view || initialized.has(view)) return;
    initialized.add(view);
    viewCharts[view] = init() || [];
  }).catch(fail);
}

function router() {
  activate((location.hash || "#overview").slice(1));
}

function fail(e) {
  console.error("[EPRWorld]", e);
  if (document.getElementById("load-error")) return;
  document.body.insertAdjacentHTML("beforeend",
    "<p id='load-error' style='color:#a92433;padding:1rem 4vw'>Data failed to load. " +
    "Serve this folder over HTTP (data files cannot load from file://).</p>");
}

function main() {
  load();
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
  Object.values(ready).forEach((p) => p.catch(fail));
}

main();
