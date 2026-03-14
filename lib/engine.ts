import bundle from "@/lib/hope/hope_calculator_bundle.json";

type EngineRow = {
  metrickey: string;
  depends_on: string | number | null;
  calc_order: number | null;
  bucket: string;
  cell: string;
  dtype: string;
  value: string | number | null;
  formula: string | null;
  formulatext: string | null;
};

type LookupRow = Record<string, string | number | null>;

type HopeResult = {
  ok: true;
  engine: EngineRow[];
  values: Record<string, string | number | null>;
};

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  return 0;
}

function lowerBoundMatch(
  lookupValue: number,
  table: LookupRow[],
  key: string
): number {
  let idx = 0;
  for (let i = 0; i < table.length; i++) {
    const rowVal = toNumber(table[i][key]);
    if (rowVal <= lookupValue) idx = i;
    if (rowVal > lookupValue) break;
  }
  return idx;
}

function indexByMatch(
  table: LookupRow[],
  returnKey: string,
  matchValue: number,
  matchKey: string
) {
  const idx = lowerBoundMatch(matchValue, table, matchKey);
  return table[idx]?.[returnKey] ?? null;
}

function translateFormula(
  expr: string,
  values: Record<string, string | number | null>
) {
  let js = expr.trim();

  if (js.startsWith("=")) js = js.slice(1);

  js = js.replace(/\^/g, "**");

  js = js.replace(/\bPI\(\)/g, "Math.PI");
  js = js.replace(/\bSQRT\(/g, "Math.sqrt(");
  js = js.replace(/\bSIN\(/g, "Math.sin(");
  js = js.replace(/\bCOS\(/g, "Math.cos(");
  js = js.replace(/\bRADIANS\(/g, "radians(");
  js = js.replace(/\bMAX\(/g, "Math.max(");
  js = js.replace(/\bMIN\(/g, "Math.min(");
  js = js.replace(/\bIF\(/g, "ifFn(");

  const keys = Object.keys(values).sort((a, b) => b.length - a.length);

  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(`\\b${escaped}\\b`, "g");
    js = js.replace(rx, `values["${key}"]`);
  }

  return js;
}

export function computeHope(
  overrides: Record<string, string | number | null> = {}
): HopeResult {
  const engineRows = [...((bundle.engine ?? []) as EngineRow[])];
  const steamTable = (bundle.lookups?.steam_table ?? []) as LookupRow[];
  const p1Table = (bundle.lookups?.p1_table ?? []) as LookupRow[];

  const values: Record<string, string | number | null> = {};

  // seed base values from engine rows
  for (const row of engineRows) {
    values[row.metrickey] = row.value ?? null;
  }

  // apply incoming UI overrides
  for (const [k, v] of Object.entries(overrides)) {
    values[k] = v;
  }

  // convergence loop: keep recalculating until values stop changing
  for (let pass = 0; pass < 12; pass++) {
    let changed = false;

    for (const row of engineRows) {
      const expr = row.formulatext?.trim();
      if (!expr) continue;

      try {
        let nextValue: string | number | null = null;

        // direct lookup / special rows
        if (row.metrickey === "P1_bar_derived") {
          nextValue = indexByMatch(
            p1Table,
            "pressure",
            toNumber(values["CR"]),
            "CR"
          );
        } else if (row.metrickey === "hf_sat_J") {
          nextValue = indexByMatch(
            steamTable,
            "hf (J/g)",
            toNumber(values["P2_bar"]),
            "PRESSURE bar"
          );
        } else if (row.metrickey === "hfg_sat_J") {
          nextValue = indexByMatch(
            steamTable,
            "hfg (J/g)",
            toNumber(values["P2_bar"]),
            "PRESSURE bar"
          );
        } else if (row.metrickey === "hg_water_theta") {
          const hg = indexByMatch(
            steamTable,
            "hg (J/g)",
            toNumber(values["P_theta_bar"]),
            "PRESSURE bar"
          );
          nextValue = toNumber(hg) * toNumber(values["m_water_kg"]) * 1000;
        } else if (row.metrickey === "pressure_required_bar") {
          nextValue = indexByMatch(
            steamTable,
            "PRESSURE bar",
            toNumber(values["T_water_rec_K"]),
            "Saturation Temperature K"
          );
        } else {
          const jsExpr = translateFormula(expr, values);

          const fn = new Function(
            "values",
            "Math",
            "toNumber",
            "radians",
            "ifFn",
            `return (${jsExpr});`
          );

          nextValue = fn(
            values,
            Math,
            toNumber,
            (deg: number) => (toNumber(deg) * Math.PI) / 180,
            (cond: unknown, a: unknown, b: unknown) => (cond ? a : b)
          );
        }

        const prev = values[row.metrickey];
        const prevNum = typeof prev === "number" ? prev : Number(prev);
        const nextNum = typeof nextValue === "number" ? nextValue : Number(nextValue);

        const same =
          prev === nextValue ||
          (Number.isFinite(prevNum) &&
            Number.isFinite(nextNum) &&
            Math.abs(prevNum - nextNum) < 1e-9);

        if (!same) {
          values[row.metrickey] = nextValue ?? null;
          changed = true;
        }
      } catch (err) {
        console.warn(`Formula failed for ${row.metrickey}:`, expr, err);
      }
    }

    if (!changed) break;
  }

  return {
    ok: true,
    engine: engineRows,
    values,
  };
}