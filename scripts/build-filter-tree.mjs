import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const infosPath = path.join(root, "talimatlar", "nsk_product_infos.json");
const searchesPath = path.join(
  root,
  "talimatlar",
  "nsk_product_brand_model_searches.json",
);
const outPath = path.join(root, "src", "static", "response.json");

function tableRows(raw) {
  const parsed = JSON.parse(raw);
  const table = parsed.find((item) => item?.type === "table" && Array.isArray(item.data));
  if (!table) {
    throw new Error("phpMyAdmin table data not found");
  }
  return table.data;
}

function sortKeys(obj) {
  return Object.keys(obj).sort((a, b) => a.localeCompare(b, "en"));
}

const infos = tableRows(fs.readFileSync(infosPath, "utf8"));
const searches = tableRows(fs.readFileSync(searchesPath, "utf8"));

const descriptionsByCode = new Map();
for (const row of infos) {
  const code = String(row.ProductCode ?? "").trim();
  const description = String(row.ProductDescription ?? "").trim();
  if (!code || !description) continue;
  if (!descriptionsByCode.has(code)) descriptionsByCode.set(code, new Set());
  descriptionsByCode.get(code).add(description);
}

const nested = {};
let skippedNoBrandOrModel = 0;
let skippedNoDescription = 0;

for (const row of searches) {
  const brand = String(row.Brand ?? "").trim();
  const model = String(row.Model ?? "").trim();
  const type = String(row.Type ?? "").trim() || "_NO_TYPE_";
  const code = String(row.ProductCode ?? "").trim();

  if (!brand || !model || !code) {
    skippedNoBrandOrModel += 1;
    continue;
  }

  const descriptions = descriptionsByCode.get(code);
  if (!descriptions || descriptions.size === 0) {
    skippedNoDescription += 1;
    continue;
  }

  nested[brand] ??= {};
  nested[brand][model] ??= {};
  nested[brand][model][type] ??= new Set();
  for (const description of descriptions) {
    nested[brand][model][type].add(description);
  }
}

const tree = {};
for (const brand of sortKeys(nested)) {
  tree[brand] = {};
  for (const model of sortKeys(nested[brand])) {
    tree[brand][model] = {};
    for (const type of sortKeys(nested[brand][model])) {
      tree[brand][model][type] = [...nested[brand][model][type]].sort((a, b) =>
        a.localeCompare(b, "en"),
      );
    }
  }
}

fs.writeFileSync(outPath, `${JSON.stringify({ tree }, null, 2)}\n`, "utf8");

const brands = Object.keys(tree);
const models = brands.reduce((n, b) => n + Object.keys(tree[b]).length, 0);
const types = brands.reduce(
  (n, b) =>
    n +
    Object.values(tree[b]).reduce((m, model) => m + Object.keys(model).length, 0),
  0,
);

console.log(
  JSON.stringify(
    {
      infos: infos.length,
      searches: searches.length,
      productCodesWithDescription: descriptionsByCode.size,
      brands: brands.length,
      models,
      types,
      skippedNoBrandOrModel,
      skippedNoDescription,
      outPath,
    },
    null,
    2,
  ),
);
