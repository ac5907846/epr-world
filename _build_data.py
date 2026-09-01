"""Build the web app data files (data/*.json) from 02_analysis results.

Not deployed: only index.html, css/, js/, data/ ship. Run again whenever the
analyses change.
"""
import json
import shutil
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
A = HERE.parent / "02_analysis"
DATA = HERE / "data"
DATA.mkdir(exist_ok=True)


def r(folder, name):
    return pd.read_csv(A / folder / "results" / name)


def rj(folder, name):
    return json.loads((A / folder / "results" / name).read_text(encoding="utf-8"))


def clean(o):
    if isinstance(o, dict):
        return {k: clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean(v) for v in o]
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating, float)):
        return None if o != o else round(float(o), 4)
    return o


def dump(obj, name):
    (DATA / name).write_text(json.dumps(clean(obj), ensure_ascii=False,
                                        separators=(",", ":")), encoding="utf-8")
    print(f"data/{name}  {(DATA / name).stat().st_size / 1e3:.0f} KB")


# ---------- countries.json ----------
d1 = r("01_descriptives", "epr_country_dataset.csv")
d2 = r("02_regression", "epr_regression_dataset.csv")[
    ["iso3c", "governance", "gdp_pc_ppp", "urban_pct", "epr_binding"]]
d15 = r("15_treemap_2050", "country_2050.csv")
c2050 = d15.rename(columns={c: "msw_2050_t" for c in d15.columns
                            if "2050" in c and d15[c].dtype != object})
c2050 = c2050[["iso3c", "msw_2050_t"]] if "msw_2050_t" in c2050 else None
d16 = r("16_ewaste_bubble", "ewaste_countries.csv")[
    ["iso3c", "ewaste_t", "ewaste_kg_pc", "epr_weee"]]

df = d1.merge(d2, on="iso3c", how="left").merge(d16, on="iso3c", how="left")
if c2050 is not None:
    df = df.merge(c2050, on="iso3c", how="left")

countries = {}
for _, row in df.iterrows():
    countries[row["iso3c"]] = {
        "name": row["country_name"],
        "region": row.get("region_id"),
        "income": row.get("income_group"),
        "epr": int(row["epr_present"]) if pd.notna(row["epr_present"]) else None,
        "binding": int(row["epr_binding"]) if pd.notna(row.get("epr_binding")) else None,
        "status": row.get("status_cat"),
        "streams": {
            "Packaging": row.get("epr_packaging"),
            "WEEE": row.get("epr_weee_x") if "epr_weee_x" in row else row.get("epr_weee"),
            "Batteries": row.get("epr_batteries"),
            "Plastics (non-pack.)": row.get("epr_plastics_nonpack"),
            "Fishing gear": row.get("epr_fishing_gear"),
            "Other": row.get("epr_other"),
        },
        "mandatory": row.get("epr_mandatory"),
        "led_by": row.get("epr_led_by"),
        "recycling": row.get("treat_recycling_pct"),
        "composting": row.get("treat_composting_pct"),
        "incineration": row.get("treat_incineration_pct"),
        "landfill": row.get("treat_landfill_pct"),
        "open_dump": row.get("treat_open_dump_pct"),
        "collection": row.get("collection_pct_pop"),
        "msw_kg_cap_day": row.get("msw_kg_cap_day"),
        "gdp_pc": row.get("gdp_pc_ppp"),
        "governance": row.get("governance"),
        "urban": row.get("urban_pct"),
        "ewaste_t": row.get("ewaste_t"),
        "ewaste_kg_pc": row.get("ewaste_kg_pc"),
        "msw_2050_t": row.get("msw_2050_t"),
    }
dump(countries, "countries.json")

# ---------- world.geojson ----------
shutil.copyfile(A / "01_descriptives" / "results" / "epr_map_data.geojson",
                DATA / "world.geojson")
print(f"data/world.geojson  {(DATA / 'world.geojson').stat().st_size / 1e3:.0f} KB")

# ---------- curves.json ----------
lw = r("04_governance_gradient", "lowess_raw.csv")
curves = {
    "marginal": r("02_regression", "marginal_effect_curve.csv").to_dict("list"),
    "rug": r("02_regression", "governance_rug.csv").to_dict("list"),
    "lowess_epr": lw[lw["epr_present"] == 1][["x", "fit", "lo", "hi"]].to_dict("list"),
    "lowess_none": lw[lw["epr_present"] == 0][["x", "fit", "lo", "hi"]].to_dict("list"),
    "gate_fit": r("14_collection_prerequisite", "segmented_fit.csv").to_dict("list"),
    "gate_meta": rj("14_collection_prerequisite", "segmented.json"),
    "gate_scatter": r("14_collection_prerequisite", "scatter_data.csv").to_dict("list"),
    "composition": r("13_composition_transition", "smoothed_bands.csv").to_dict("list"),
}
dump(curves, "curves.json")

# ---------- treemap.json ----------
dump({
    "tiles": r("15_treemap_2050", "tiles.csv").to_dict("records"),
    "shares": r("15_treemap_2050", "status_shares.csv").to_dict("records"),
}, "treemap.json")

# ---------- specs.json ----------
sp = r("11_specification_curve", "specs.csv").sort_values("coef").reset_index(drop=True)
dump({
    "coef": sp["coef"].tolist(), "lo": sp["ci_lo"].tolist(),
    "hi": sp["ci_hi"].tolist(), "sig": (sp["p"] < .05).astype(int).tolist(),
    "epr_var": sp["epr_var"].tolist(), "gov_var": sp["gov_var"].tolist(),
    "sample": sp["sample"].tolist(),
}, "specs.json")

# ---------- meta.json (headlines + model for the tool) ----------
reg = rj("02_regression", "epr_regression_results.json")
m3 = reg["m3_ols_interaction_governance"]["params"]
s01 = rj("01_descriptives", "summary.json")
s15 = rj("15_treemap_2050", "summary.json")
s16 = rj("16_ewaste_bubble", "summary.json")
meta = {
    "n_countries": s01["n_countries"],
    "epr_n": s01["epr_present_n"],
    "epr_pct": s01["epr_present_pct"],
    "interaction": reg["m3_ols_interaction_governance"]["params"]["epr_present:governance"],
    "interaction_p": reg["m3_ols_interaction_governance"]["pvalues"]["epr_present:governance"],
    "model": {"epr": m3["epr_present"], "inter": m3["epr_present:governance"]},
    "gate_break": rj("14_collection_prerequisite", "segmented.json")["break_pct"],
    "treemap_summary": s15,
    "ewaste_summary": {k: s16[k] for k in
                       ("share_uncovered_pct", "world_reported_mt") if k in s16},
    "built": "2026-08-30",
}
dump(meta, "meta.json")
print("done")
