import bundle from "@/lib/hope/hope_calculator_bundle.json";

type MetricRow = {
  metrickey: string;
  label?: string | null;
  notes?: string | null;
  panel?: string | null;
  panel_order?: number | null;
  item_order?: number | null;
  value?: string | number | null;
  valuedisplay?: string | number | null;
  displaymask?: string | null;
  editmask?: string | null;
  format?: string | null;
  dtype?: string | null;
};

type PanelRow = {
  panel: string;
  panelorder: number;
};

export type BuiltField = {
  key: string;
  label: string;
  notes: string;
  value: string | number | null;
  format: string | null;
  dtype: string | null;
  editable: boolean;
};

export type BuiltPanel = {
  panel: string;
  panelorder: number;
  fields: BuiltField[];
};

export function buildPanels(values: Record<string, string | number | null> = {}) {
  const metrics = (bundle.metrics ?? []) as MetricRow[];
  const panels = (bundle.panels ?? []) as PanelRow[];

  const visibleMetrics = metrics
    .filter((m) => m.displaymask === "show" && m.panel)
    .map((m) => ({
      ...m,
      resolvedValue:
        values[m.metrickey] !== undefined ? values[m.metrickey] : (m.value ?? null),
    }));

  const result: BuiltPanel[] = panels
    .sort((a, b) => a.panelorder - b.panelorder)
    .map((p) => {
      const fields = visibleMetrics
        .filter((m) => m.panel === p.panel)
        .sort((a, b) => (a.item_order ?? 999) - (b.item_order ?? 999))
        .map((m) => ({
          key: m.metrickey,
          label: m.label ?? m.metrickey,
          notes: m.notes ?? "",
          value: m.resolvedValue ?? "",
          format: m.format ?? null,
          dtype: m.dtype ?? null,
          editable: m.editmask === "edit",
        }));

      return {
        panel: p.panel,
        panelorder: p.panelorder,
        fields,
      };
    });

  return result;
}
