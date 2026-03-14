export type UiRole = "input" | "derived" | "readonly" | "hidden";

export type Format =
  | "text"
  | "int"
  | "1dp"
  | "2dp"
  | "percent_1"
  | "percent_2";

export type DType = "number" | "text" | "percent";

export type SchemaItem = {
  metric_key: string;

  panel_key: string;
  panel_order: number; // from panel_map in Excel
  item_order: number;

  label: string;
  ui_role: UiRole;

  // Optional UX controls
  ui_visible?: boolean; // if missing, assume true
  ui_priority?: number; // optional ordering override

  dtype: DType;
  unit?: string; // can be "" if unit is embedded in label
  min?: number;
  max?: number;
  default?: number | string;

  format: Format;
  notes?: string;
};

export type SchemaJSON = { items: SchemaItem[] };

export type InputState = Record<string, string | number>;
export type OutputState = Record<string, string | number>;

export type EngineResult = {
  outputs: OutputState;
  // if you want validation / warnings later
  warnings?: string[];
};