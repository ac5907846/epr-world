/* Landing view: the four steps of the article drawn in one chart. The marks
   are countries, and they morph from step to step: regions of the map become
   points of the scatter, points gather into the estimates by income group,
   and the estimates open into the tiles of projected waste. Every value is
   read from data/story.json and data/hero.json.

   The page shows in two beats so that it never looks empty: prepareStory()
   needs only the small story file and fills the buttons and the readout;
   start() draws the chart once the chart library and the map are there. */

function prepareStory(S) {
  let CN = null, ch = null;             // set by start()
  const dom = document.getElementById("chart-story");
  const INK = "#1c1e26", INK2 = "#494e5c", INK3 = "#818697",
        RULE = "#c9cdd8", GRID = "#e9ebf1";
  const COL = { binding: "#1b56ad", non: "#6eaf8e", none: "#d5d9e4" };
  const KEY = { binding: "Binding EPR", non: "Non-binding EPR", none: "No EPR" };
  const cls = (c) => (c.binding === 1 ? "binding" : c.epr === 1 ? "non" : "none");
  const inc = (c) => (c.income === "HIC" ? "High income" : "Low and middle income");
  /* The first round of the tour runs faster than the reading pace, so that
     a visitor sees all four steps soon after arriving: steps of 3 s instead
     of 4, and morphs, counts and fades shortened in the same proportion. The
     reading pace returns when the tour comes back to the first step, or as
     soon as the reader chooses a step or pauses. */
  let quick = !M.reduced;
  const pace = () => (quick ? .75 : 1);
  const ms = (t) => (M.reduced ? 0 : t * pace());       // a duration at the current pace
  const axis = {
    axisLine: { lineStyle: { color: RULE } }, axisTick: { show: false },
    axisLabel: { color: INK }, nameTextStyle: { color: INK },
    splitLine: { lineStyle: { color: GRID } },
  };
  const base = () => ({ animation: !M.reduced, animationDuration: ms(1000),
                        animationDurationUpdate: ms(750), animationEasingUpdate: "cubicInOut" });

  /* ---- step 1: the map ---- */
  function mapOption() {
    const box = dom;
    const wide = box.clientWidth / Math.max(1, box.clientHeight) > 1.95;
    const fit = wide ? { left: "center", top: 10, bottom: 6 }
                     : { left: 4, right: 4, top: "middle" };
    return { ...base(),
      tooltip: { formatter: (p) => {
        const c = CN[p.name];
        return c ? `${c.name}<br>${KEY[cls(c)]}` : "";
      } },
      series: [{ id: "story", type: "map", map: "world", nameProperty: "iso3c",
        universalTransition: true, roam: false, ...fit,
        itemStyle: { areaColor: "#eef0f5", borderColor: "#fff", borderWidth: .5 },
        emphasis: { label: { show: false }, itemStyle: { areaColor: "#d98e12" } },
        select: { disabled: true },
        data: Object.entries(CN).map(([iso, c]) => ({
          name: iso, value: 1, groupId: inc(c),
          itemStyle: { areaColor: COL[cls(c)] } })) }],
    };
  }

  /* ---- step 2: recycling against governance ---- */
  function scatterOption() {
    const fit = S.test.fitted_lines;
    const line = (key, color, dash) => ({
      type: "line", symbol: "none", silent: true, z: 5,
      data: fit[key].governance.map((g, i) => [g, fit[key].recycling[i]]),
      lineStyle: { color, width: 3, type: dash ? "dashed" : "solid" },
      endLabel: { show: true, formatter: key, color: INK, fontSize: 12 },
      animationDuration: ms(550), animationDelay: ms(750) * .7,
    });
    return { ...base(),
      grid: { left: 58, right: 118, top: 20, bottom: 48 },
      tooltip: { formatter: (p) => {
        const c = CN[p.name];
        return c ? `${c.name}<br>${KEY[cls(c)]}<br>governance ${M.num(p.value[0], 2)}, ` +
          `recycling ${M.num(p.value[1], 1)}%` : "";
      } },
      xAxis: { name: "Governance (WGI composite)", min: -2, max: 2.5, interval: 1,
               nameLocation: "middle", nameGap: 30, ...axis,
               axisLabel: { color: INK, showMaxLabel: false } },
      yAxis: { name: "Recycling (% of MSW generated)", min: 0, max: 60,
               nameLocation: "middle", nameGap: 38, ...axis },
      series: [
        { id: "story", type: "scatter", universalTransition: true, symbolSize: 10,
          data: S.sample.map((iso) => {
            const c = CN[iso];
            return { name: iso, value: [c.governance, c.recycling], groupId: inc(c),
              itemStyle: { color: COL[cls(c)], borderColor: "#fff", borderWidth: .6,
                           opacity: .9 } };
          }) },
        line("Binding EPR", COL.binding, false),
        line("Other countries", INK2, true),
      ],
    };
  }

  /* ---- step 3: the interaction within income groups ---- */
  function groupsOption() {
    const XMIN = -24, XMAX = 24;
    const rows = ["Low and middle income", "High income", "All countries"]
      .map((k) => ({ k, ...S.check[k] }));
    return { ...base(),
      grid: { left: 188, right: 30, top: 20, bottom: 48 },
      tooltip: { formatter: (p) => {
        const r = rows.find((q) => q.k === p.name);
        return r ? `${r.k} (n = ${r.n})<br>${M.num(r.coef, 2)}, 95% interval ` +
          `${M.num(r.lo, 1)} to ${M.num(r.hi, 1)}, ${M.pval(r.p)}` : "";
      } },
      xAxis: { name: "Interaction of binding EPR with governance (points of recycling)",
               min: XMIN, max: XMAX, nameLocation: "middle", nameGap: 30, ...axis },
      yAxis: { type: "category", data: rows.map((r) => r.k), ...axis,
               axisLine: { show: false }, splitLine: { show: false },
               axisLabel: { color: INK, fontSize: 13 } },
      series: [
        { type: "custom", silent: true, z: 2,
          animationDuration: ms(450), animationDelay: ms(750) * .6,
          renderItem: (params, api) => {
            const i = api.value(2), lo = api.value(0), hi = api.value(1);
            const a = api.coord([Math.max(lo, XMIN), i]);
            const b = api.coord([Math.min(hi, XMAX), i]);
            const st = { stroke: INK2, fill: INK2, lineWidth: 2 };
            const head = (x, y, d) => ({ type: "polygon", style: st,
              shape: { points: [[x, y - 5], [x + 9 * d, y], [x, y + 5]] } });
            const parts = [{ type: "line", style: st,
              shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] } }];
            if (lo < XMIN) parts.push(head(a[0], a[1], -1));   // interval runs on
            if (hi > XMAX) parts.push(head(b[0], b[1], 1));
            return { type: "group", children: parts };
          },
          data: rows.map((r, i) => [r.lo, r.hi, i]) },
        { id: "story", type: "scatter", universalTransition: true, symbolSize: 18, z: 4,
          markLine: { silent: true, symbol: "none", animation: false,
            lineStyle: { color: RULE, type: "solid" }, label: { show: false },
            data: [{ xAxis: 0 }] },
          label: { show: true, position: "top", distance: 8, color: INK, fontSize: 12,
            formatter: (p) => {
              const r = rows[p.dataIndex];
              return `${M.num(r.coef, 1)} (${M.pval(r.p)})`;
            } },
          data: rows.map((r, i) => ({ name: r.k, value: [r.coef, i], groupId: r.k,
            itemStyle: r.p < .05
              ? { color: COL.binding }
              : { color: "#fff", borderColor: INK2, borderWidth: 2 } })) },
      ],
    };
  }

  /* ---- step 4: municipal waste projected for 2050 ---- */
  function wasteOption() {
    const groups = ["binding", "non", "none"].map((k) => ({
      name: KEY[k], itemStyle: { color: COL[k] },
      children: Object.entries(CN)
        .filter(([, c]) => cls(c) === k && c.msw_2050_t > 0)
        .map(([iso, c]) => ({ name: iso, value: c.msw_2050_t, groupId: inc(c),
          itemStyle: { color: COL[k] },
          label: { color: k === "binding" ? "#fff" : INK } })) }));
    return { ...base(),
      tooltip: { formatter: (p) => {
        const c = CN[p.name];
        return c ? `${c.name}<br>${M.num(p.value / 1e6, 1)} Mt projected for 2050<br>` +
          KEY[cls(c)] : `${p.name}<br>${M.num(p.value / 1e9, 2)} billion tonnes`;
      } },
      series: [{ id: "story", type: "treemap", universalTransition: true,
        left: 0, right: 0, top: 8, bottom: 0, roam: false, nodeClick: false,
        breadcrumb: { show: false },
        label: { fontSize: 11,
          formatter: (p) => (p.value > 3e7 && CN[p.name] ? CN[p.name].name : "") },
        levels: [
          { itemStyle: { borderWidth: 0, gapWidth: 4 } },
          { itemStyle: { borderColor: "#fff", borderWidth: 0, gapWidth: 1 } },
        ],
        data: groups }],
    };
  }

  /* ---- the steps and what is read off each ---- */
  const T = S.test, G = S.check, O = S.outlook;
  const steps = [
    { button: "Coverage", title: "EPR schemes by legal status",
      option: mapOption, value: S.map.epr_pct, dec: 0, unit: "%",
      label: `of ${S.map.countries} countries and economies have an EPR scheme`,
      detail: `${S.map.binding} binding, ${S.map.non_binding} non-binding, ` +
              `${S.map.none} without a scheme`,
      source: "Figure 1 and Table 2 of the article" },
    { button: "Governance", title: "Recycling against governance",
      option: scatterOption, value: T.binding_x_governance.coef, dec: 1, unit: "points",
      label: "of recycling per unit of governance: the interaction of binding EPR " +
             `with governance (${M.pval(T.binding_x_governance.p)}, n = ${T.n})`,
      detail: `EPR presence alone: ${M.num(T.epr_alone.coef, 1)} points ` +
              `(${M.pval(T.epr_alone.p)})`,
      source: "Table 3 and Figure 4 of the article" },
    { button: "Income groups", title: "The interaction within income groups",
      option: groupsOption, value: G["Low and middle income"].coef, dec: 1, unit: "points",
      label: "the same interaction among low- and middle-income countries " +
             `(${M.pval(G["Low and middle income"].p)}, n = ${G["Low and middle income"].n})`,
      detail: `High-income countries: ${M.num(G["High income"].coef, 1)} ` +
              `(${M.pval(G["High income"].p)}, n = ${G["High income"].n}). ` +
              "Filled marker: p < .05.",
      source: "Table 5 of the article" },
    { button: "2050", title: "Municipal waste projected for 2050",
      option: wasteOption, value: O.share_2050_without_binding_epr_pct, dec: 1, unit: "%",
      label: "of the municipal waste projected for 2050 arises in countries " +
             "without binding EPR",
      detail: `Waste grows from ${M.num(O.msw_2022_bn_t, 2)} to ` +
              `${M.num(O.msw_2050_bn_t, 2)} billion tonnes; low- and lower-middle-income ` +
              `countries account for ${O.low_and_lower_middle_pct}% of the growth`,
      source: "Figure 10 and Table S9 of the article" },
  ];

  /* ---- controls ---- */
  const $ = (id) => document.getElementById(id);
  const playBtn = $("story-play"), ro = $("story-readout");
  const view = $("view-overview");
  const stepBox = $("story-steps");
  stepBox.innerHTML = steps.map((s, k) =>
    `<button type="button" data-step="${k}">${s.button}</button>`).join("");
  $("story-key").innerHTML = Object.keys(KEY).map((k) =>
    `<span><i style="background:${COL[k]}"></i>${KEY[k]}</span>`).join("");

  const STEP_MS = 4000;
  let cur = -1, playing = false, t0 = 0, elapsed = 0;

  function show(k) {
    cur = (k + steps.length) % steps.length;
    const s = steps[cur];
    if (ch) ch.setOption(s.option(), true);
    stepBox.querySelectorAll("button").forEach((b, j) =>
      b.classList.toggle("active", j === cur));
    ro.classList.remove("in");
    ro.classList.toggle("quick", quick);      // the fade at the pace of the round
    void ro.offsetWidth;                      // restart the fade of the text
    ro.classList.add("in");
    ro.querySelector(".ro-title").textContent = s.title;
    ro.querySelector(".ro-unit").textContent = s.unit;
    ro.querySelector(".ro-label").textContent = s.label;
    ro.querySelector(".ro-detail").textContent = s.detail;
    ro.querySelector(".ro-src").textContent = s.source;
    M.count(ro.querySelector(".ro-n"), s.value, s.dec, 650 * pace());
    elapsed = 0;
    t0 = performance.now();
  }

  function tick(now) {
    if (!playing) return;
    /* the clock waits while the page or this view is not shown */
    if (document.hidden || !view.classList.contains("active")) t0 = now - elapsed;
    elapsed = now - t0;
    if (elapsed >= STEP_MS * pace()) {
      if (cur === steps.length - 1) quick = false;     // back to the first step: the first round is over
      show(cur + 1);
    }
    M.frame(tick);
  }
  function play() {
    if (playing) return;
    playing = true;
    playBtn.textContent = "Pause";
    if (!ch) return;                      // start() sets the clock going
    t0 = performance.now() - elapsed;
    M.frame(tick);
  }
  function pause() {
    playing = false;
    quick = false;                        // the reader has taken over: reading pace
    playBtn.textContent = "Play";
  }

  playBtn.addEventListener("click", () => (playing ? pause() : play()));
  stepBox.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) { quick = false; show(+b.dataset.step); }
  });
  /* The readout and the buttons, before any chart exists. */
  show(0);
  /* The tour is on unless the reader asked for reduced motion; its clock
     runs only while the overview is shown (see tick). */
  if (M.reduced) pause(); else play();

  /* The chart joins in. The tour keeps running: it stops only when the
     reader presses Pause or clicks on the figure; scrolling, keys and
     clicks elsewhere do not stop it, and choosing a step continues from
     that step. */
  function start(DATA) {
    CN = DATA.hero;
    ch = echarts.init(dom);
    ch.setOption(steps[cur].option(), true);
    dom.addEventListener("click", pause);
    window.addEventListener("resize", () => {
      if (cur === 0) ch.setOption(steps[0].option(), true);   // refit the map
    });
    elapsed = 0;
    t0 = performance.now();
    if (playing) M.frame(tick);
    return ch;
  }
  return { start };
}
