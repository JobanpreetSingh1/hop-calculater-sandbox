import fs from "fs";
import path from "path";

const inputPath = path.resolve("lib/hope/hope_lookup_steam_table.tsv");
const outputPath = path.resolve("lib/hope/hope_lookup_steam_table.json");

function coerce(value) {
  if (value == null) return null;
  const v = String(value).trim();
  if (v === "") return null;

  if (/^-?\d+$/.test(v)) return Number(v);
  if (/^-?(?:\d+\.\d*|\d*\.\d+)(?:e[+-]?\d+)?$/i.test(v)) return Number(v);

  return v;
}

const raw = fs.readFileSync(inputPath, "utf8").replace(/\r\n/g, "\n");
const lines = raw.split("\n").filter((line) => line.trim() !== "");

if (lines.length < 2) {
  throw new Error("Steam table TSV is empty or missing data rows.");
}

const headers = lines[0].split("\t").map((h) => h.trim());

const rows = lines.slice(1).map((line) => {
  const cols = line.split("\t");
  const obj = {};

  for (let i = 0; i < headers.length; i++) {
    obj[headers[i]] = coerce(cols[i] ?? "");
  }

  return obj;
});

fs.writeFileSync(outputPath, JSON.stringify(rows, null, 2), "utf8");

console.log(`Created: ${outputPath}`);
console.log(`Rows: ${rows.length}`);
