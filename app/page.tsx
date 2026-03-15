"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Sankey,

} from "recharts";

type UiRole = "input" | "readonly" | "derived" | "hidden" | "hidden_value" | string;
type DType = "number" | "percent" | "text" | string;

type ItemSchema = {
  metric_key: string;
  panel_key: string;
  panel_order: number;
  item_order: number;
  label: string;
  ui_role: UiRole;
  dtype?: DType;
  min?: any;
  max?: any;
  default?: any;
  format?: string;
  notes?: string;
  ui_visible?: string | boolean;
  ui_priority?: string | number;
};

type MasterSchema = {
  items: ItemSchema[];
};

type ComputeResponse = {
  ok?: boolean;
  values: Record<string, any>;
  value_display?: Record<string, string>;
};

type ModelState = {
  id: string;
  name: string;
  inputs: Record<string, any>;
  values: Record<string, any>;
  valueDisplay: Record<string, string>;
};

type PanelGroup = {
  panel_key: string;
  panel_order: number;
  items: ItemSchema[];
};

const MAX_MODELS = 5;

const KEY_METRICS = new Set([
  "CR",
  "lambda",
  "rpm",
  "bore_stroke_ratio",
  "P1_bar_derived",
  "P2_bar",
  "T2_C",
  "P3_real_bar",
  "T3_real_C",
  "W_comp_J",
  "W_exp_real_J",
  "W_net_real_J",
  "eta_brake_pct",
  "BMEP_bar",
  "Power_brake_kW",
  "bsfc_g_kWh",
  "Q_exh_real_bal_J",
  "water_phase_result",
]);

const GRAPH_METRIC_OPTIONS = [
  { key: "T2_C", label: "T2 Compression Temperature (°C)" },
  { key: "T3_real_C", label: "T3 Real Combustion Temperature (°C)" },
  { key: "P2_bar", label: "P2 Compression Pressure (bar)" },
  { key: "P3_real_bar", label: "P3 Real Peak Pressure (bar)" },
  { key: "eta_brake_pct", label: "Brake Efficiency (%)" },
  { key: "bsfc_g_kWh", label: "BSFC (g/kWh)" },
];

const EDITABLE_INPUT_KEYS = new Set([
  "CR",
  "lambda",
  "rpm",
  "bore_stroke_ratio",
]);

function shouldShow(it: ItemSchema) {
  const v = (it.ui_visible ?? "TRUE") as any;
  const isVisible = typeof v === "boolean" ? v : String(v).toLowerCase() !== "false";
  const role = (it.ui_role ?? "").toLowerCase();
  if (!isVisible) return false;
  if (role === "hidden_row" || role === "hidden") return false;
  return true;
}

function isEditable(it: ItemSchema) {
  return (it.ui_role ?? "").toLowerCase() === "input";
}

function normalizeDType(dtype?: string): DType {
  const dt = (dtype ?? "").toLowerCase().trim();
  if (dt === "percent " || dt === "percent") return "percent";
  if (dt === "number") return "number";
  if (dt === "text") return "text";
  return dt || "text";
}

function coerceDefault(it: ItemSchema) {
  if (it.default !== undefined && it.default !== null && it.default !== "") return it.default;
  const dt = normalizeDType(it.dtype);
  return dt === "number" || dt === "percent" ? 0 : "";
}

function shouldInit(uiRole?: string) {
  const r = (uiRole ?? "").toLowerCase().trim();
  return r === "input" || r === "readonly";
}

function buildInitialInputs(schema: MasterSchema) {
  const init: Record<string, any> = {};
  for (const it of schema.items ?? []) {
    if (!it?.metric_key) continue;
    if (shouldInit(it.ui_role)) {
      init[it.metric_key] = coerceDefault(it);
    }
  }
  return init;
}

function safeNumber(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clampIfNeeded(it: ItemSchema, raw: any) {
  const dt = normalizeDType(it.dtype);
  if (dt !== "number" && dt !== "percent") return raw;

  const n = safeNumber(raw);
  if (n === null) return raw;

  const mn = safeNumber(it.min);
  const mx = safeNumber(it.max);

  let out = n;
  if (mn !== null) out = Math.max(out, mn);
  if (mx !== null) out = Math.min(out, mx);
  return out;
}

function nextModelName(count: number) {
  return `Model ${String.fromCharCode(65 + count)}`;
}

function formatModelNameFromInputs(inputs: Record<string, any>, fallback: string) {
  const cr = Number(inputs?.CR);
  if (!Number.isFinite(cr) || cr <= 0) return fallback;
  return `HOPE-${Math.round(cr)}`;
}

function uniqueModelName(
  proposed: string,
  currentId: string,
  models: { id: string; name: string }[]
) {
  const used = models.filter((m) => m.id !== currentId).map((m) => m.name);
  if (!used.includes(proposed)) return proposed;

  let i = 2;
  while (used.includes(`${proposed} (${i})`)) i++;
  return `${proposed} (${i})`;
}

function formatValueForDisplay(it: ItemSchema, raw: any) {
  if (it.metric_key === "m_water_display") return "Internally optimized";
  if (raw === null || raw === undefined || raw === "") return "";

  const fmt = String(it.format ?? "").toLowerCase();
  const dt = String(it.dtype ?? "").toLowerCase();

  if (dt === "percent" || fmt.startsWith("percent")) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return String(raw);
    if (fmt === "percent_1") return `${(n * 100).toFixed(1)}%`;
    if (fmt === "percent_2") return `${(n * 100).toFixed(2)}%`;
    return `${(n * 100).toFixed(2)}%`;
  }

  if (fmt === "int") {
    const n = Number(raw);
    return Number.isFinite(n) ? String(Math.round(n)) : String(raw);
  }

  if (fmt === "1dp") {
    const n = Number(raw);
    return Number.isFinite(n) ? n.toFixed(1) : String(raw);
  }

  if (fmt === "2dp") {
    const n = Number(raw);
    return Number.isFinite(n) ? n.toFixed(2) : String(raw);
  }

  return String(raw);
}

function downloadTextFile(
  filename: string,
  content: string,
  mime = "text/plain;charset=utf-8"
) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildDisplayExportCsv(panels: PanelGroup[], models: ModelState[]) {
  const header = ["Panel", "Metric", "Label", ...models.map((m) => m.name)];
  const rows: string[][] = [header];

  for (const panel of panels) {
    for (const it of panel.items) {
      const row = [
        panel.panel_key,
        it.metric_key,
        it.label,
        ...models.map((model) => {
          if (model.valueDisplay[it.metric_key] !== undefined) {
            return String(model.valueDisplay[it.metric_key]);
          }
          if (model.values[it.metric_key] !== undefined) {
            return formatValueForDisplay(it, model.values[it.metric_key]);
          }
          if (model.inputs[it.metric_key] !== undefined) {
            return formatValueForDisplay(it, model.inputs[it.metric_key]);
          }
          return "";
        }),
      ];
      rows.push(row);
    }
  }

  return rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function splitPanels(source: PanelGroup[]): PanelGroup[] {
  const out: PanelGroup[] = [];

  for (const panel of source) {
    if (panel.panel_key !== "Input") {
      out.push(panel);
      continue;
    }

    const editable = panel.items.filter((it) => EDITABLE_INPUT_KEYS.has(it.metric_key));
    const reference = panel.items.filter((it) => !EDITABLE_INPUT_KEYS.has(it.metric_key));

    out.push({
      panel_key: "Editable Inputs",
      panel_order: panel.panel_order,
      items: editable,
    });

    out.push({
      panel_key: "Reference Inputs",
      panel_order: panel.panel_order + 0.1,
      items: reference,
    });
  }

  return out;
}

function getRangeText(it: ItemSchema) {
  const min = it.min;
  const max = it.max;

  if (min === undefined || min === null || max === undefined || max === null) {
    return "";
  }

  const dt = normalizeDType(it.dtype);

  if (dt === "percent") {
    const minNum = Number(min);
    const maxNum = Number(max);
    if (Number.isFinite(minNum) && Number.isFinite(maxNum)) {
      return `Range: ${(minNum * 100).toFixed(1)}%–${(maxNum * 100).toFixed(1)}%`;
    }
  }

  return `Range: ${min}–${max}`;
}

function getPanelHeaderColor(panelKey: string) {
  switch (panelKey) {
    case "Editable Inputs":
      return "#0e5a7a";
    case "Reference Inputs":
      return "#0d5a4d";
    case "Compression":
      return "#5a2d0d";
    case "Pressure & Force":
      return "#6b1538";
    case "Temperature":
      return "#5a2d0d";
    case "Heat":
      return "#5a1d2e";
    case "Work":
      return "#0d5a4d";
    case "Efficiency":
      return "#0d5a4d";
    case "Performance":
      return "#0e5a7a";
    case "Operating Envelope":
      return "#1a1a3a";
    default:
      return "#1e293b";
  }
}

function isPercentMetric(metricKey: string) {
  return metricKey === "eta_brake_pct";
}

function getGraphMetricDecimals(metricKey: string) {
  switch (metricKey) {
    case "T2_C":
    case "T3_real_C":
    case "P2_bar":
    case "P3_real_bar":
    case "bsfc_g_kWh":
      return 1;
    case "eta_brake_pct":
      return 1;
    default:
      return 2;
  }
}

function formatGraphValue(metricKey: string, raw: number) {
  if (!Number.isFinite(raw)) return "";
  const decimals = getGraphMetricDecimals(metricKey);
  if (isPercentMetric(metricKey)) {
    return `${(raw * 100).toFixed(decimals)}%`;
  }
  return raw.toFixed(decimals);
}

function pctOfInput(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total === 0) return 0;
  return (value / total) * 100;
}

function pctOfGrossCooling(value: number, gross: number) {
  if (!Number.isFinite(value) || !Number.isFinite(gross) || gross === 0) return 0;
  return (value / gross) * 100;
}

function safeMetric(values: Record<string, any>, key: string) {
  const n = Number(values?.[key]);
  return Number.isFinite(n) ? n : 0;
}

function linspace(start: number, end: number, count: number) {
  if (count <= 1) return [start];
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, i) => start + i * step);
}



export default function Page() {
  const graphRef = useRef<HTMLDivElement | null>(null);
  const ihrlRef = useRef<HTMLDivElement | null>(null);
  const netEnergyRef = useRef<HTMLDivElement | null>(null);
  const [schema, setSchema] = useState<MasterSchema | null>(null);
  const [models, setModels] = useState<ModelState[]>([]);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [loadingCompute, setLoadingCompute] = useState(false);
  const [err, setErr] = useState("");
  const [keyMetricsOnly, setKeyMetricsOnly] = useState(false);
  const [selectedGraphMetric, setSelectedGraphMetric] = useState("T2_C");
  const [selectedSankeyModelId, setSelectedSankeyModelId] = useState<string>("");


  const [panelOpen, setPanelOpen] = useState<Record<string, boolean>>({
    "Performance Graph": true,

    "Editable Inputs": true,
    "Reference Inputs": false,
    Compression: true,
    "Pressure & Force": false,
    Temperature: false,
    Heat: false,
    Work: false,
    Efficiency: true,
    Performance: true,
    "Operating Envelope": false,
    "IHRL Cooling Recovery Flow": true,
    "Sankey Energy Flow": true,
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoadingSchema(true);
        setErr("");

        const res = await fetch("/api/schema", { method: "GET" });
        if (!res.ok) throw new Error(`Schema fetch failed: ${res.status}`);

        const data = (await res.json()) as MasterSchema;
        if (!alive) return;

        const items = Array.isArray(data.items) ? data.items : [];
        const cleaned: MasterSchema = {
          items: items
            .filter((x) => x && x.metric_key && x.panel_key)
            .map((x) => ({
              ...x,
              panel_order: Number((x as any).panel_order ?? 999),
              item_order: Number((x as any).item_order ?? 999),
              dtype: normalizeDType((x as any).dtype),
            })),
        };

        setSchema(cleaned);

        const init = buildInitialInputs(cleaned);
        const firstId = crypto.randomUUID();
        const firstName = formatModelNameFromInputs(init, "Model A");

        setModels([
          {
            id: firstId,
            name: firstName,
            inputs: init,
            values: {},
            valueDisplay: {},
          },
        ]);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load schema");
      } finally {
        setLoadingSchema(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!schema || models.length === 0) return;

    let cancelled = false;

    const snapshot = models.map((m) => ({
      id: m.id,
      inputs: { ...m.inputs },
    }));

    const handle = setTimeout(() => {
      (async () => {
        try {
          setLoadingCompute(true);
          setErr("");

          const computed = await Promise.all(
            snapshot.map(async (model) => {
              const res = await fetch("/api/compute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inputs: model.inputs }),
              });

              if (!res.ok) throw new Error(`Compute failed: ${res.status}`);
              const data = (await res.json()) as ComputeResponse;

              return {
                id: model.id,
                values: data.values ?? {},
                valueDisplay: data.value_display ?? {},
              };
            })
          );

          if (cancelled) return;

          setModels((prev) =>
            prev.map((model) => {
              const hit = computed.find((x) => x.id === model.id);
              if (!hit) return model;
              return {
                ...model,
                values: hit.values,
                valueDisplay: hit.valueDisplay,
              };
            })
          );
        } catch (e: any) {
          if (!cancelled) setErr(e?.message ?? "Compute failed");
        } finally {
          if (!cancelled) setLoadingCompute(false);
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [schema, models.map((m) => JSON.stringify(m.inputs)).join("|"), models.length]);

  useEffect(() => {
    if (!models.length) return;
    const exists = models.some((m) => m.id === selectedSankeyModelId);
    if (!selectedSankeyModelId || !exists) {
      setSelectedSankeyModelId(models[0].id);
    }
  }, [models, selectedSankeyModelId]);



  const panels = useMemo(() => {
    if (!schema) return [];

    const items = schema.items.filter((it) => {
      if (!shouldShow(it)) return false;
      if (!keyMetricsOnly) return true;
      return KEY_METRICS.has(it.metric_key);
    });

    const byPanel = new Map<string, ItemSchema[]>();

    for (const it of items) {
      if (!byPanel.has(it.panel_key)) byPanel.set(it.panel_key, []);
      byPanel.get(it.panel_key)!.push(it);
    }

    const panelList: PanelGroup[] = Array.from(byPanel.entries()).map(([panel_key, list]) => ({
      panel_key,
      panel_order: Math.min(...list.map((x) => x.panel_order ?? 999)),
      items: [...list].sort((a, b) => (a.item_order ?? 999) - (b.item_order ?? 999)),
    }));

    panelList.sort((a, b) => a.panel_order - b.panel_order);
    return splitPanels(panelList);
  }, [schema, keyMetricsOnly]);

  const graphData = useMemo(() => {
    return models
      .map((model, idx) => {
        const cr = Number(model.inputs.CR);
        const raw = model.values[selectedGraphMetric];

        let value: number | null = null;
        if (raw !== undefined && raw !== null && raw !== "") {
          const num = Number(raw);
          value = Number.isFinite(num) ? num : null;
        }

        return {
          name: model.name || `Model ${idx + 1}`,
          CR: Number.isFinite(cr) ? cr : idx + 1,
          value,
          valueLabel: value !== null ? formatGraphValue(selectedGraphMetric, value) : "",
        };
      })
      .filter((row) => row.value !== null)
      .sort((a, b) => a.CR - b.CR);
  }, [models, selectedGraphMetric]);

  const sankeyModel = useMemo(() => {
    return models.find((m) => m.id === selectedSankeyModelId) ?? models[0] ?? null;
  }, [models, selectedSankeyModelId]);

  const ihrlSankeyData = useMemo(() => {
    if (!sankeyModel) return null;

    const values = sankeyModel.values ?? {};
    const coolGross = safeMetric(values, "Q_cool_gross_J");
    const coolNet = safeMetric(values, "Q_cool_net_J");
    const ihrl = safeMetric(values, "Q_rec_IHRL_J");

    return {
      nodes: [
        { name: "Cooling Gross" },
        { name: "IHRL Recovery" },
        { name: "Cooling Net Loss" },
      ],
      links: [
        { source: 0, target: 1, value: Math.max(ihrl, 0) },
        { source: 0, target: 2, value: Math.max(coolNet, 0) },
      ],
      summary: {
        coolGross,
        ihrl,
        coolNet,
        ihrlPct: pctOfGrossCooling(ihrl, coolGross),
        coolNetPct: pctOfGrossCooling(coolNet, coolGross),
      },
    };
  }, [sankeyModel]);

  const sankeyData = useMemo(() => {
    if (!sankeyModel) return null;

    const values = sankeyModel.values ?? {};
    const qIn = safeMetric(values, "Q_in_J");
    const brake = safeMetric(values, "W_brake_J");
    const exhaust = safeMetric(values, "Q_exh_real_bal_J");
    const coolNet = safeMetric(values, "Q_cool_net_J");
    const friction = safeMetric(values, "Q_fric_J");
    const unburned = safeMetric(values, "Q_ub_J");

    return {
      nodes: [
        { name: "Fuel Input" },
        { name: "Cycle Energy" },
        { name: "Brake Work" },
        { name: "Exhaust" },
        { name: "Cooling Net Loss" },
        { name: "Friction" },
        { name: "Unburned" },
      ],
      links: [
        { source: 0, target: 1, value: qIn },
        { source: 1, target: 2, value: Math.max(brake, 0) },
        { source: 1, target: 3, value: Math.max(exhaust, 0) },
        { source: 1, target: 4, value: Math.max(coolNet, 0) },
        { source: 1, target: 5, value: Math.max(friction, 0) },
        { source: 1, target: 6, value: Math.max(unburned, 0) },
      ],
      summary: {
        qIn,
        brakePct: pctOfInput(brake, qIn),
        exhaustPct: pctOfInput(exhaust, qIn),
        coolNetPct: pctOfInput(coolNet, qIn),
        frictionPct: pctOfInput(friction, qIn),
        unburnedPct: pctOfInput(unburned, qIn),
      },
    };
  }, [sankeyModel]);

  function addModel() {
    if (!schema) return;

    setModels((prev) => {
      if (prev.length >= MAX_MODELS) return prev;

      const baseInputs =
        prev.length > 0 ? prev[prev.length - 1].inputs : buildInitialInputs(schema);

      const fallback = nextModelName(prev.length);
      const proposed = formatModelNameFromInputs(baseInputs, fallback);
      const finalName = uniqueModelName(proposed, "__new__", prev);

      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: finalName,
          inputs: { ...baseInputs },
          values: {},
          valueDisplay: {},
        },
      ];
    });
  }

  function resetAllModels() {
    if (!schema) return;
    const base = buildInitialInputs(schema);

    setModels([
      {
        id: crypto.randomUUID(),
        name: formatModelNameFromInputs(base, "Model A"),
        inputs: base,
        values: {},
        valueDisplay: {},
      },
    ]);
  }

  function onChange(modelId: string, it: ItemSchema, nextRaw: string) {
    setModels((prev) =>
      prev.map((model) => {
        if (model.id !== modelId) return model;
        return {
          ...model,
          inputs: { ...model.inputs, [it.metric_key]: nextRaw },
        };
      })
    );
  }

  function onBlurValue(modelId: string, it: ItemSchema) {
    setModels((prev) =>
      prev.map((model) => {
        if (model.id !== modelId) return model;

        const dt = normalizeDType(it.dtype);
        const raw = model.inputs[it.metric_key];
        const nextInputs = { ...model.inputs };

        if (dt === "number" || dt === "percent") {
          if (raw !== "" && raw !== null && raw !== undefined) {
            const n = Number(raw);
            if (Number.isFinite(n)) {
              nextInputs[it.metric_key] = clampIfNeeded(it, n);
            } else {
              nextInputs[it.metric_key] = coerceDefault(it);
            }
          }
        }

        let nextName = model.name;
        if (it.metric_key === "CR") {
          const fallback = model.name.startsWith("HOPE-") ? "Model" : model.name;
          const proposed = formatModelNameFromInputs(nextInputs, fallback);
          nextName = uniqueModelName(proposed, model.id, prev);
        }

        return {
          ...model,
          name: nextName,
          inputs: nextInputs,
        };
      })
    );
  }

  function getDisplayValue(model: ModelState, it: ItemSchema) {
    if (model.valueDisplay[it.metric_key] !== undefined) return model.valueDisplay[it.metric_key];
    if (model.values[it.metric_key] !== undefined) return formatValueForDisplay(it, model.values[it.metric_key]);
    if (model.inputs[it.metric_key] !== undefined) return formatValueForDisplay(it, model.inputs[it.metric_key]);
    return "";
  }

  function exportDisplayCsv() {
    const csv = buildDisplayExportCsv(panels, models);
    downloadTextFile("hope_display_compare.csv", csv, "text/csv;charset=utf-8");
  }

  async function downloadPanelPng(
    ref: React.RefObject<HTMLDivElement | null>,
    fileName: string
  ) {
    if (!ref.current) return;

    const dataUrl = await toPng(ref.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
    });

    const link = document.createElement("a");
    link.download = fileName;
    link.href = dataUrl;
    link.click();
  }

  async function downloadExplorerPdf() {
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const sections = [
      { ref: graphRef, title: "Performance Graph" },
      { ref: ihrlRef, title: "IHRL Cooling Recovery Flow" },
      { ref: netEnergyRef, title: "Net Energy Partition" },
    ];

    let first = true;

    for (const section of sections) {
      if (!section.ref.current) continue;

      const dataUrl = await toPng(section.ref.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });

      const img = new Image();
      img.src = dataUrl;

      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
      });

      const imgWidth = img.width;
      const imgHeight = img.height;

      const usableWidth = pageWidth - 20;
      const usableHeight = pageHeight - 20;

      const scale = Math.min(usableWidth / imgWidth, usableHeight / imgHeight);
      const renderWidth = imgWidth * scale;
      const renderHeight = imgHeight * scale;

      if (!first) pdf.addPage();

      pdf.setFontSize(12);
      pdf.text(section.title, 10, 10);
      pdf.addImage(dataUrl, "PNG", 10, 15, renderWidth, renderHeight);

      first = false;
    }

    pdf.save("hope_explorer_report.pdf");
  }

  function togglePanel(panelKey: string) {
    setPanelOpen((prev) => ({
      ...prev,
      [panelKey]: !(prev[panelKey] ?? true),
    }));
  }

  if (loadingSchema && !schema) {
    return (
      <main style={{ padding: 20, fontFamily: "system-ui, Arial", color: "#f1f5f9", backgroundColor: "#0f172a" }}>
        <h1>HOPE Hybrid Cycle Explorer</h1>
        <p>Loading schema…</p>
      </main>
    );
  }

  return (
    <main
      style={{
        padding: 20,
        fontFamily: "system-ui, Arial",
        maxWidth: 1600,
        margin: "0 auto",
        color: "#f1f5f9",
        backgroundColor: "#0f172a",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <div>
          <h1 style={{ margin: 0, color: "#f1f5f9" }}>HOPE Hybrid Cycle Explorer</h1>
          <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4, color: "#94a3b8" }}>
            Hydro Oxy Palta Engine • Reference Model • FAQ + White Paper Backed
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setKeyMetricsOnly((v) => !v)}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid #475569",
              background: keyMetricsOnly ? "#38bdf8" : "#1e293b",
              color: keyMetricsOnly ? "#0f172a" : "#f1f5f9",
              cursor: "pointer",
              fontWeight: keyMetricsOnly ? 700 : 400,
              transition: "0.2s",
            }}
          >
            {keyMetricsOnly ? "Key Metrics" : "Key Metrics Only"}
          </button>

          <button
            type="button"
            onClick={addModel}
            disabled={!schema || models.length >= MAX_MODELS}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid #475569",
              background: "#1e293b",
              color: "#f1f5f9",
              cursor: "pointer",
              opacity: !schema || models.length >= MAX_MODELS ? 0.5 : 1,
              transition: "0.2s",
            }}
          >
            + Add Model
          </button>

          <button
            type="button"
            onClick={resetAllModels}
            disabled={!schema}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid #475569",
              background: "#1e293b",
              color: "#f1f5f9",
              cursor: "pointer",
              opacity: !schema ? 0.5 : 1,
              transition: "0.2s",
            }}
          >
            Reset All
          </button>

          <button
            type="button"
            onClick={exportDisplayCsv}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid #475569",
              background: "#1e293b",
              color: "#f1f5f9",
              cursor: "pointer",
              transition: "0.2s",
            }}
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => downloadPanelPng(graphRef, "hope_performance_graph.png")}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid #475569",
              background: "#1e293b",
              color: "#f1f5f9",
              cursor: "pointer",
              transition: "0.2s",
            }}
          >
            Download Graph PNG
          </button>

          <button
            type="button"
            onClick={downloadExplorerPdf}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid #475569",
              background: "#1e293b",
              color: "#f1f5f9",
              cursor: "pointer",
              transition: "0.2s",
            }}
          >
            Download PDF
          </button>

          <div style={{ fontSize: 12, opacity: 0.8, color: "#94a3b8" }}>
            {loadingCompute ? "Computing…" : "Ready"}
          </div>
        </div>
      </div>

      {err ? (
        <div style={{ marginBottom: 12, padding: 10, border: "1px solid #dc2626", borderRadius: 8, backgroundColor: "#7f1d1d", color: "#fca5a5" }}>
          <b>Error:</b> {err}
        </div>
      ) : null}

      {models.length > 0 ? (
        <section
          style={{
            border: "1px solid #334155",
            borderRadius: 14,
            background: "#1e293b",
            overflowX: "auto",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `260px repeat(${models.length}, minmax(180px, 1fr))`,
              alignItems: "stretch",
            }}
          >
            <div
              style={{
                padding: "12px 14px",
                borderBottom: "1px solid #334155",
                background: "#0f172a",
                fontWeight: 700,
                position: "sticky",
                left: 0,
                zIndex: 3,
                boxShadow: "2px 0 0 #334155",
                color: "#38bdf8",
              }}
            >
              Models
            </div>

            {models.map((model) => (
              <div
                key={model.id}
                style={{
                  padding: "12px 14px",
                  borderBottom: "1px solid #334155",
                  background: "#0f172a",
                  textAlign: "center",
                  fontWeight: 700,
                  fontSize: 15,
                  borderLeft: "1px solid #475569",
                  color: "#f1f5f9",
                }}
              >
                {model.name}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {!schema ? (
        <p>No schema loaded.</p>
      ) : (
        <div style={{ display: "grid", gap: 18 }}>
          {panels.map((panel) => {
            const isOpen = panelOpen[panel.panel_key] ?? true;

            return (
              <section
                key={panel.panel_key}
                style={{
                  border: "1px solid #334155",
                  borderRadius: 14,
                  background: "#1e293b",
                  overflowX: "auto",
                }}
              >
                <button
                  type="button"
                  onClick={() => togglePanel(panel.panel_key)}
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 16px",
                    border: "none",
                    background: getPanelHeaderColor(panel.panel_key),
                    cursor: "pointer",
                    textAlign: "left",
                    borderBottom: "1px solid #334155",
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                    color: "#0f172a",
                    transition: "0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "0.9";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "1";
                  }}
                >
                  <span style={{ fontSize: 18, fontWeight: 700 }}>
                    {isOpen ? "▼ " : "▶ "} {panel.panel_key}
                  </span>
                  <span style={{ fontSize: 12, opacity: 0.6 }}>Panel #{panel.panel_order}</span>
                </button>

                {isOpen ? (
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                    <thead>
                      <tr>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "10px 12px",
                            borderTop: "1px solid #334155",
                            borderBottom: "1px solid #334155",
                            background: getPanelHeaderColor(panel.panel_key),
                            position: "sticky",
                            left: 0,
                            zIndex: 3,
                            minWidth: 260,
                            boxShadow: "2px 0 0 #334155",
                            color: "#0f172a",
                          }}
                        >
                          Metric
                        </th>

                        {models.map((model) => (
                          <th
                            key={model.id}
                            style={{
                              padding: "10px 12px",
                              borderTop: "1px solid #334155",
                              borderBottom: "1px solid #334155",
                              background: getPanelHeaderColor(panel.panel_key),
                              minWidth: 180,
                              borderLeft: "1px solid #475569",
                              color: "#0f172a",
                            }}
                          />
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {panel.items.map((it, rowIndex) => {
                        const role = (it.ui_role ?? "").toLowerCase();
                        if (role === "hidden") return null;

                        return (
                          <tr
                            key={`${panel.panel_key}-${it.metric_key}`}
                            style={{
                              background: rowIndex % 2 === 0 ? "#1e293b" : "#0f172a",
                            }}
                          >
                            <td
                              style={{
                                padding: "10px 12px",
                                borderBottom: "1px solid #334155",
                                verticalAlign: "top",
                                background: rowIndex % 2 === 0 ? "#1e293b" : "#0f172a",
                                position: "sticky",
                                left: 0,
                                zIndex: 2,
                                minWidth: 260,
                                boxShadow: "2px 0 0 #334155",
                                color: "#f1f5f9",
                              }}
                            >
                              <div style={{ fontWeight: 600 }}>{it.label}</div>

                              {panel.panel_key === "Editable Inputs" && getRangeText(it) ? (
                                <div
                                  style={{
                                    fontSize: 12,
                                    opacity: 0.65,
                                    marginTop: 4,
                                    color: "#94a3b8",
                                  }}
                                >
                                  {getRangeText(it)}
                                </div>
                              ) : null}
                            </td>

                            {models.map((model) => {
                              const display = getDisplayValue(model, it);
                              const masked = role === "hidden_value";

                              return (
                                <td
                                  key={`${model.id}-${it.metric_key}`}
                                  style={{
                                    padding: "10px 12px",
                                    borderBottom: "1px solid #334155",
                                    textAlign: "right",
                                    verticalAlign: "middle",
                                    borderLeft: "1px solid #475569",
                                    color: "#f1f5f9",
                                  }}
                                >
                                  {isEditable(it) ? (
                                    <input
                                      value={model.inputs[it.metric_key] ?? ""}
                                      onChange={(e) => onChange(model.id, it, e.target.value)}
                                      onBlur={(e) => {
                                        onBlurValue(model.id, it);
                                        e.currentTarget.style.borderColor = "#475569";
                                        e.currentTarget.style.boxShadow = "none";
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          onBlurValue(model.id, it);
                                          (e.target as HTMLInputElement).blur();
                                        }
                                      }}
                                      style={{
                                        width: "100%",
                                        minWidth: 120,
                                        padding: "8px 10px",
                                        borderRadius: 6,
                                        border: "1px solid #475569",
                                        fontSize: 14,
                                        textAlign: "right",
                                        background: "#0f172a",
                                        color: "#f1f5f9",
                                        transition: "0.2s",
                                      }}
                                      inputMode={
                                        normalizeDType(it.dtype) === "number" ||
                                          normalizeDType(it.dtype) === "percent"
                                          ? "decimal"
                                          : "text"
                                      }
                                      onFocus={(e) => {
                                        e.currentTarget.style.borderColor = "#38bdf8";
                                        e.currentTarget.style.boxShadow = "0 0 0 2px rgba(56, 189, 248, 0.1)";
                                      }}
                                    />
                                  ) : (
                                    <div
                                      style={{
                                        display: "inline-block",
                                        minWidth: 120,
                                        padding: "8px 10px",
                                        borderRadius: 6,
                                        border: "1px solid #475569",
                                        background: "#0f172a",
                                        fontVariantNumeric: "tabular-nums",
                                        fontFeatureSettings: '"tnum"',
                                        textAlign: "right",
                                        color: "#f1f5f9",
                                      }}
                                    >
                                      {masked ? "••••" : display}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : null}
              </section>
            );
          })}

          <section
            style={{
              border: "1px solid #334155",
              borderRadius: 14,
              background: "#1e293b",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => togglePanel("Performance Graph")}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 16px",
                border: "none",
                background: "#0e5a7a",
                cursor: "pointer",
                textAlign: "left",
                borderBottom: "1px solid #334155",
                fontWeight: 700,
                letterSpacing: "0.02em",
                color: "#f1f5f9",
                transition: "0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#0d4f6b";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#0e5a7a";
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 700 }}>
                {(panelOpen["Performance Graph"] ?? true) ? "▼ " : "▶ "} Performance Graph
              </span>
              <span style={{ fontSize: 12, opacity: 0.6 }}>
                HOPE Cycle Thermodynamic Trend
              </span>
            </button>

            {(panelOpen["Performance Graph"] ?? true) ? (
              <div ref={graphRef} style={{ padding: 16, background: "#1e293b" }}>
                <div
                  style={{
                    marginBottom: 14,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>
                      Graph Metric:
                    </label>

                    <select
                      value={selectedGraphMetric}
                      onChange={(e) => setSelectedGraphMetric(e.target.value)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 6,
                        border: "1px solid #475569",
                        background: "#0f172a",
                        color: "#f1f5f9",
                        cursor: "pointer",
                      }}
                    >
                      {GRAPH_METRIC_OPTIONS.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ fontSize: 14, fontWeight: 700, opacity: 0.8, color: "#38bdf8" }}>
                    {GRAPH_METRIC_OPTIONS.find((x) => x.key === selectedGraphMetric)?.label}
                  </div>
                </div>

                <div style={{ width: "100%", height: 340 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={graphData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      {selectedGraphMetric === "T2_C" ? (
                        <ReferenceLine
                          y={430}
                          stroke="#f97316"
                          strokeDasharray="4 4"
                          label={{ value: "Knock Limit (~700K)", fill: "#f97316", position: "right" }}
                        />
                      ) : null}
                      <XAxis dataKey="CR" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          border: "1px solid #334155",
                          borderRadius: "8px",
                          color: "#f1f5f9",
                        }}
                        cursor={{ stroke: "#334155" }}
                        formatter={(value: any) => {
                          const num = Number(value);
                          return [formatGraphValue(selectedGraphMetric, num), "Value"];
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#38bdf8"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: "#38bdf8" }}
                        activeDot={{ r: 6, fill: "#38bdf8" }}
                        isAnimationActive={true}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : null}
          </section>


          <section
            style={{
              border: "1px solid #334155",
              borderRadius: 14,
              background: "#1e293b",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => togglePanel("IHRL Cooling Recovery Flow")}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 16px",
                border: "none",
                background: "#0d5a4d",
                cursor: "pointer",
                textAlign: "left",
                borderBottom: "1px solid #334155",
                fontWeight: 700,
                letterSpacing: "0.02em",
                color: "#f1f5f9",
                transition: "0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#0a4a3d";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#0d5a4d";
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 700 }}>
                {(panelOpen["IHRL Cooling Recovery Flow"] ?? true) ? "▼ " : "▶ "} IHRL Cooling Recovery Flow
              </span>
              <span style={{ fontSize: 12, opacity: 0.6 }}>
                Gross cooling split into recovery and residual net loss
              </span>
            </button>

            {(panelOpen["IHRL Cooling Recovery Flow"] ?? true) ? (
              <div ref={ihrlRef} style={{ padding: 16, background: "#1e293b" }}>
                <div
                  style={{
                    marginBottom: 14,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>
                      Model:
                    </label>

                    <select
                      value={selectedSankeyModelId}
                      onChange={(e) => setSelectedSankeyModelId(e.target.value)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 6,
                        border: "1px solid #475569",
                        background: "#0f172a",
                        color: "#f1f5f9",
                        cursor: "pointer",
                      }}
                    >
                      {models.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ fontSize: 14, fontWeight: 700, opacity: 0.8, color: "#22c55e" }}>
                    {sankeyModel?.name ?? ""}
                  </div>
                </div>

                {ihrlSankeyData ? (
                  <>
                    <div style={{ width: "100%", height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <Sankey
                          data={ihrlSankeyData}
                          nodePadding={70}
                          nodeWidth={20}
                          margin={{ top: 10, right: 120, bottom: 10, left: 120 }}
                          linkCurvature={0.35}
                          node={{ stroke: "#f1f5f9", strokeWidth: 2, fill: "#38bdf8" }}
                          link={{ stroke: "#475569", strokeOpacity: 0.5 }}
                        />
                      </ResponsiveContainer>
                    </div>

                    <div
                      style={{
                        marginTop: 14,
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: 10,
                      }}
                    >
                      <div style={{ padding: "10px 12px", border: "1px solid #475569", borderRadius: 10, background: "#0f172a" }}>
                        <div style={{ fontSize: 12, opacity: 0.7, color: "#94a3b8" }}>Cooling Gross</div>
                        <div style={{ fontWeight: 700, color: "#f1f5f9" }}>{ihrlSankeyData.summary.coolGross.toFixed(0)} J</div>
                      </div>
                      <div style={{ padding: "10px 12px", border: "1px solid #475569", borderRadius: 10, background: "#0f172a" }}>
                        <div style={{ fontSize: 12, opacity: 0.7, color: "#94a3b8" }}>IHRL Recovery</div>
                        <div style={{ fontWeight: 700, color: "#22c55e" }}>
                          {ihrlSankeyData.summary.ihrl.toFixed(0)} J ({ihrlSankeyData.summary.ihrlPct.toFixed(1)}%)
                        </div>
                      </div>
                      <div style={{ padding: "10px 12px", border: "1px solid #475569", borderRadius: 10, background: "#0f172a" }}>
                        <div style={{ fontSize: 12, opacity: 0.7, color: "#94a3b8" }}>Cooling Net Loss</div>
                        <div style={{ fontWeight: 700, color: "#f1f5f9" }}>
                          {ihrlSankeyData.summary.coolNet.toFixed(0)} J ({ihrlSankeyData.summary.coolNetPct.toFixed(1)}%)
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </section>

          <section
            style={{
              border: "1px solid #334155",
              borderRadius: 14,
              background: "#1e293b",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => togglePanel("Sankey Energy Flow")}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 16px",
                border: "none",
                background: "#5a2d0d",
                cursor: "pointer",
                textAlign: "left",
                borderBottom: "1px solid #334155",
                fontWeight: 700,
                letterSpacing: "0.02em",
                color: "#f1f5f9",
                transition: "0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#6b380f";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#5a2d0d";
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 700 }}>
                {(panelOpen["Sankey Energy Flow"] ?? true) ? "▼ " : "▶ "} Net Energy Partition
              </span>
              <span style={{ fontSize: 12, opacity: 0.6 }}>
                Final cycle energy distribution using net cooling loss
              </span>
            </button>

            {(panelOpen["Sankey Energy Flow"] ?? true) ? (
              <div ref={netEnergyRef} style={{ padding: 16, background: "#1e293b" }}>
                <div
                  style={{
                    marginBottom: 14,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>
                      Model:
                    </label>

                    <select
                      value={selectedSankeyModelId}
                      onChange={(e) => setSelectedSankeyModelId(e.target.value)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 6,
                        border: "1px solid #475569",
                        background: "#0f172a",
                        color: "#f1f5f9",
                        cursor: "pointer",
                      }}
                    >
                      {models.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ fontSize: 14, fontWeight: 700, opacity: 0.8, color: "#f97316" }}>
                    {sankeyModel?.name ?? ""}
                  </div>
                </div>

                {sankeyData ? (
                  <>
                    <div style={{ width: "100%", height: 360 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <Sankey
                          data={sankeyData}
                          nodePadding={55}
                          nodeWidth={20}
                          margin={{ top: 10, right: 120, bottom: 10, left: 120 }}
                          linkCurvature={0.35}
                          node={{ stroke: "#f1f5f9", strokeWidth: 2, fill: "#38bdf8" }}
                          link={{ stroke: "#475569", strokeOpacity: 0.5 }}
                        />
                      </ResponsiveContainer>
                    </div>

                    <div
                      style={{
                        marginTop: 14,
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: 10,
                      }}
                    >
                      <div style={{ padding: "10px 12px", border: "1px solid #475569", borderRadius: 10, background: "#0f172a" }}>
                        <div style={{ fontSize: 12, opacity: 0.7, color: "#94a3b8" }}>Fuel Input</div>
                        <div style={{ fontWeight: 700, color: "#f97316" }}>{sankeyData.summary.qIn.toFixed(0)} J</div>
                      </div>
                      <div style={{ padding: "10px 12px", border: "1px solid #475569", borderRadius: 10, background: "#0f172a" }}>
                        <div style={{ fontSize: 12, opacity: 0.7, color: "#94a3b8" }}>Brake Work</div>
                        <div style={{ fontWeight: 700, color: "#22c55e" }}>{sankeyData.summary.brakePct.toFixed(1)}%</div>
                      </div>
                      <div style={{ padding: "10px 12px", border: "1px solid #475569", borderRadius: 10, background: "#0f172a" }}>
                        <div style={{ fontSize: 12, opacity: 0.7, color: "#94a3b8" }}>Exhaust</div>
                        <div style={{ fontWeight: 700, color: "#f1f5f9" }}>{sankeyData.summary.exhaustPct.toFixed(1)}%</div>
                      </div>
                      <div style={{ padding: "10px 12px", border: "1px solid #475569", borderRadius: 10, background: "#0f172a" }}>
                        <div style={{ fontSize: 12, opacity: 0.7, color: "#94a3b8" }}>Cooling Net</div>
                        <div style={{ fontWeight: 700, color: "#f1f5f9" }}>{sankeyData.summary.coolNetPct.toFixed(1)}%</div>
                      </div>
                      <div style={{ padding: "10px 12px", border: "1px solid #475569", borderRadius: 10, background: "#0f172a" }}>
                        <div style={{ fontSize: 12, opacity: 0.7, color: "#94a3b8" }}>Friction</div>
                        <div style={{ fontWeight: 700, color: "#f1f5f9" }}>{sankeyData.summary.frictionPct.toFixed(1)}%</div>
                      </div>
                      <div style={{ padding: "10px 12px", border: "1px solid #475569", borderRadius: 10, background: "#0f172a" }}>
                        <div style={{ fontSize: 12, opacity: 0.7, color: "#94a3b8" }}>Unburned</div>
                        <div style={{ fontWeight: 700, color: "#f1f5f9" }}>{sankeyData.summary.unburnedPct.toFixed(1)}%</div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      )}
    </main>
  );
}