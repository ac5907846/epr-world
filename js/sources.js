/* Sources view: the six sources of data of the article, and the legal
   instrument and the sources behind the adoption year of each EPR scheme
   (Table 1 of the article, and Table S1 of its supplementary materials with
   the references that the table cites). */

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

/* A source as its citation (author and year), which links to the document;
   the full reference is the tooltip. A second address of the same document
   (its record in a legal database, or an archived copy) follows in brackets. */
function sourceLinks(ref) {
  const link = (url, label) =>
    `<a href="${esc(url)}" target="_blank" rel="noopener" title="${esc(ref.reference)}">${esc(label)}</a>`;
  const more = ref.urls.slice(1).map((u) =>
    link(u, u.includes("web.archive.org") ? "archived copy" : "second address"));
  return `<span class="src-ref">${link(ref.urls[0], ref.cite)}` +
    (more.length ? ` (${more.join(", ")})` : "") + "</span>";
}

function initSources(DATA) {
  const S = DATA.sources;

  document.getElementById("sources-datasets").innerHTML =
    `<table class="src-table"><thead><tr><th>Source</th><th>Data used</th>
       <th>Countries</th><th>Years</th></tr></thead><tbody>` +
    S.datasets.map((d) => `<tr>
       <td>${d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.name)}</a>`
                   : "Multiple sources, listed below"}</td>
       <td>${esc(d.used)}</td><td class="num">${esc(d.countries)}</td>
       <td>${esc(d.years)}</td></tr>`).join("") +
    "</tbody></table>";

  const entries = Object.entries(S.adoption)
    .map(([iso, rows]) => ({ iso, name: DATA.countries[iso].name, rows }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const body = document.getElementById("sources-adoption");
  const count = document.getElementById("sources-count");

  function render(query) {
    const q = query.trim().toLowerCase();
    const shown = entries.filter((e) => !q || e.name.toLowerCase().includes(q));
    const cited = new Set();
    let instruments = 0;
    const html = shown.map((e) => e.rows.map((r, k) => {
      instruments += 1;
      r.refs.forEach((ref) => cited.add(ref.cite));
      return `<tr><td>${k ? "" : esc(e.name)}</td><td class="num">${esc(r.year)}</td>
        <td>${esc(r.instrument)}</td>
        <td class="links">${r.refs.map(sourceLinks).join("")}</td></tr>`;
    }).join("")).join("");
    body.innerHTML =
      `<table class="src-table"><thead><tr><th>Country</th><th>Year</th>
         <th>Instrument</th><th>Sources</th></tr></thead><tbody>${html}</tbody></table>`;
    count.textContent = `${shown.length} countries, ${instruments} instruments, ${cited.size} sources`;
  }

  document.getElementById("sources-filter").addEventListener("input", (e) => render(e.target.value));
  render("");
}

/* The same entry for one country, as a card of the country profile. */
function instrumentCard(DATA, iso) {
  const rows = DATA.sources.adoption[iso];
  if (!rows) return "";
  return `<div class="tool-card"><div>First EPR instrument</div>` +
    rows.map((r) => `<div class="src-inst">${r.year ? `<b>${esc(r.year)}</b> ` : ""}${esc(r.instrument)}
      <div class="src-links">${r.refs.map(sourceLinks).join("")}</div></div>`).join("") +
    "</div>";
}
