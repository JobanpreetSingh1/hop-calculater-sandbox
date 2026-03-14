import fs from "fs";
import path from "path";

const root = path.resolve("lib/hope");

const readJson = (name) =>
  JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));

const engine = readJson("hope_engine_ordered.json");
const metrics = readJson("hope_metrics.json");
const panels = readJson("hope_panels.json");
const panelMap = readJson("hope_panel_map.json");
const steamTable = readJson("hope_lookup_steam_table.json");
const p1Table = readJson("hope_lookup_table_p1.json");

const bundle = {
  engine,
  metrics,
  panels,
  panel_map: panelMap,
  lookups: {
    steam_table: steamTable,
    p1_table: p1Table
  }
};

fs.writeFileSync(
  path.join(root, "hope_calculator_bundle.json"),
  JSON.stringify(bundle, null, 2),
  "utf8"
);

console.log("Created: lib/hope/hope_calculator_bundle.json");
console.log(`engine rows: ${engine.length}`);
console.log(`metrics rows: ${metrics.length}`);
console.log(`panels rows: ${panels.length}`);
console.log(`panel map rows: ${panelMap.length}`);
console.log(`steam rows: ${steamTable.length}`);
console.log(`p1 rows: ${p1Table.length}`);