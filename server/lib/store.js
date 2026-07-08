import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

export function readJson(name, fallback) {
  const p = filePath(name);
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return fallback;
  }
}

export function writeJson(name, data) {
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), "utf-8");
}
