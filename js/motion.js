/* Motion helpers shared by the views: reduced-motion flag, a frame clock that
   also runs where requestAnimationFrame is throttled, number formats of the
   article, and a counter that moves from the value shown to the next one. */

const M = (() => {
  const reduced = !!(window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* One callback per frame. The timer is a fallback: a throttled or headless
     page still gets its frame, so counts and tours always finish. */
  function frame(fn) {
    let done = false;
    const run = (t) => {
      if (done) return;
      done = true;
      fn(typeof t === "number" ? t : performance.now());
    };
    if (window.requestAnimationFrame) window.requestAnimationFrame(run);
    setTimeout(run, 60);
  }

  /* Numbers as in the article: no leading zero below 1, no plus sign. */
  function num(v, dec = 1) {
    const a = Math.abs(v).toFixed(dec);
    const sign = v < 0 && +a !== 0 ? "-" : "";
    return sign + a.replace(/^0(?=\.)/, "");
  }

  function pval(p) {
    if (p < .001) return "p < .001";
    return "p = " + num(p, p < .01 ? 3 : 2);
  }

  /* Count from the value the element shows now to a new one. */
  function count(el, to, dec = 1, ms = 900) {
    const from = typeof el._v === "number" ? el._v : 0;
    el._v = to;
    const id = (el._run = (el._run || 0) + 1);
    if (reduced || from === to) { el.textContent = num(to, dec); return; }
    const t0 = performance.now();
    const step = (now) => {
      if (el._run !== id) return;                 // a newer count took over
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);           // ease out
      el.textContent = num(from + (to - from) * e, dec);
      if (k < 1) frame(step);
    };
    frame(step);
  }

  return { reduced, frame, num, pval, count };
})();
