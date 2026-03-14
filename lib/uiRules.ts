// lib/uiRules.ts

export type UiRole =
  | "input"
  | "not_editable"
  | "derived"
  | "constraint"
  | "ideal"
  | "real"
  | "brake";

export interface UiRow {
  panel: string;
  panel_order: number;
  item_order: number;
  label: string;
  metric_key: string;
  value: string | number;
  unit?: string;
  ui_role: UiRole;
}

export function isEditable(role: UiRole): boolean {
  return role === "input";
}

export function isVisibleInSandbox(role: UiRole): boolean {
  return role === "input" || role === "not_editable" || role === "derived";
}

export function roleClass(role: UiRole): string {
  switch (role) {
    case "input":
      return "role-input";
    case "not_editable":
      return "role-fixed";
    case "derived":
      return "role-derived";
    case "constraint":
      return "role-constraint";
    case "ideal":
      return "role-ideal";
    case "real":
      return "role-real";
    case "brake":
      return "role-brake";
    default:
      return "";
  }
}
