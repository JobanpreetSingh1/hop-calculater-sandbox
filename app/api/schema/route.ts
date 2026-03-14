import { NextResponse } from "next/server";
import bundle from "@/lib/hope/hope_calculator_bundle.json";

type MetricRow = {
  metrickey: string;
  panel?: string | null;
  panel_order?: number | string | null;
  item_order?: number | string | null;
  label?: string | null;
  editmask?: string | null;
  displaymask?: string | null;
  dtype?: string | null;
  min?: string | number | null;
  max?: string | number | null;
  default?: string | number | null;
  value?: string | number | null;
  format?: string | null;
  notes?: string | null;
};

export async function GET() {
  const metrics = (bundle.metrics ?? []) as MetricRow[];

  const items = metrics.map((m) => {
    const displaymask = String(m.displaymask ?? "show").toLowerCase();
    const editmask = String(m.editmask ?? "lock").toLowerCase();

    let ui_role = "readonly";
    if (displaymask === "hide") ui_role = "hidden";
    else if (editmask === "edit") ui_role = "input";
    else ui_role = "readonly";

    return {
      metric_key: m.metrickey,
      panel_key: m.panel ?? "Misc",
      panel_order: Number(m.panel_order ?? 999),
      item_order: Number(m.item_order ?? 999),
      label:
        m.metrickey === "fuel"
          ? "Fuel"
          : String(m.label ?? m.metrickey).replace(/Expantion/g, "Expansion"),
      ui_role,
      dtype: (m.dtype ?? "text").toString().trim().toLowerCase(),
      min: m.min ?? null,
      max: m.max ?? null,
      default: m.default ?? m.value ?? null,
      format: m.format ?? null,
      notes: m.notes ?? "",
      ui_visible: displaymask !== "hide",
      ui_priority: Number(m.item_order ?? 999),
    };
  });

  return NextResponse.json({ items }, { status: 200 });
}