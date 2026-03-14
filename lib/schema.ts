import type { SchemaItem, SchemaJSON } from "./types";

export function indexSchema(items: SchemaItem[]) {
  const byMetric = new Map<string, SchemaItem>();

  for (const it of items) {
    byMetric.set(it.metric_key, it);
  }

  const panels = Array.from(
    items.reduce((acc, it) => {
      const key = it.panel_key;

      if (!acc.has(key)) {
        acc.set(key, {
          panel_key: key,
          panel_order: it.panel_order,
          items: [] as SchemaItem[],
        });
      }

      acc.get(key)!.items.push(it);
      return acc;
    }, new Map<string, { panel_key: string; panel_order: number; items: SchemaItem[] }>())
      .values()
  )
    .map((p) => ({
      ...p,
      items: p.items
        .filter((x) => (x.ui_visible ?? true) !== false)
        .sort((a, b) => (a.item_order ?? 0) - (b.item_order ?? 0)),
    }))
    .sort((a, b) => (a.panel_order ?? 0) - (b.panel_order ?? 0));

  return { byMetric, panels };
}

export async function loadSchema(url = "/api/schema"): Promise<SchemaItem[]> {
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Failed to load schema: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as SchemaJSON;

  if (!json?.items || !Array.isArray(json.items)) {
    throw new Error(`Schema must be { "items": [...] }`);
  }

  return json.items;
}