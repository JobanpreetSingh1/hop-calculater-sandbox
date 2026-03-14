import type { Format } from "./types";

export function formatValue(value: string | number, fmt: Format, unit?: string) {
  if (value === null || value === undefined) return "";

  // Pass text through
  if (fmt === "text") return String(value);

  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return String(value);

  let s = "";
  switch (fmt) {
    case "int":
      s = String(Math.round(num));
      break;
    case "1dp":
      s = num.toFixed(1);
      break;
    case "2dp":
      s = num.toFixed(2);
      break;

    // IMPORTANT: percent formats expect FRACTION input (0.5808 -> 58.08)
    case "percent_1":
      s = (num * 100).toFixed(1);
      break;
    case "percent_2":
      s = (num * 100).toFixed(2);
      break;

    default:
      s = String(num);
  }

  // If you embedded unit in label, keep unit empty.
  if (!unit) return s;

  // For percent, add "%" automatically if unit says %
  if (unit === "%") return `${s}%`;

  return `${s} ${unit}`;
}
