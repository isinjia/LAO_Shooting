import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
const files = new Set();
const readJson = async (rel) => JSON.parse(await fs.readFile(path.join(root, rel), 'utf8'));
const exists = async (rel) => fs.access(path.join(root, rel)).then(() => true, () => false);

function include(rel) {
  const normalized = rel.replaceAll('\\', '/');
  if (path.isAbsolute(rel) || normalized.split('/').includes('..')) {
    throw new Error(`Invalid asset path: ${rel}`);
  }
  files.add(normalized);
}

async function includeTree(rel, extensions) {
  for (const entry of await fs.readdir(path.join(root, rel), { withFileTypes: true })) {
    const child = `${rel}/${entry.name}`;
    if (entry.isDirectory()) await includeTree(child, extensions);
    else if (entry.isFile() && extensions.has(path.extname(child))) include(child);
  }
}

for (const rel of ['index.html', 'play.html']) include(rel);
await includeTree('js', new Set(['.js', '.txt']));
await includeTree('css', new Set(['.css']));
const media = new Set(['.png', '.webp', '.jpg', '.jpeg', '.svg', '.ogg', '.mp3', '.wav', '.json']);
for (const directory of ['audio', 'bg', 'bori', 'enemy', 'native-shots', 'player', 'ui']) {
  await includeTree(`assets/${directory}`, media);
}

let packed = 0;
let fallback = 0;
for (const entry of await fs.readdir(path.join(root, 'assets/sd_baked'), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const base = `assets/sd_baked/${entry.name}`;
  if (!await exists(`${base}/anim.json`)) continue;
  const anim = await readJson(`${base}/anim.json`);
  include(`${base}/anim.json`);
  if (await exists(`${base}/preview.png`)) include(`${base}/preview.png`);
  const sheetFile = typeof anim.sheet === 'string' ? anim.sheet : 'sheet.json';
  if (await exists(`${base}/${sheetFile}`)) {
    const sheet = await readJson(`${base}/${sheetFile}`);
    if (!sheet.sheets?.length) throw new Error(`Empty atlas: ${base}/${sheetFile}`);
    for (const clip of ['idle', 'move', 'die']) {
      if ((anim[clip]?.length || 0) !== (sheet[clip]?.length || 0)) {
        throw new Error(`Atlas clip differs from source: ${base}/${clip}`);
      }
    }
    include(`${base}/${sheetFile}`);
    for (const image of sheet.sheets) include(`${base}/${image}`);
    if (await exists(`${base}/sheet_lo.json`)) {
      include(`${base}/sheet_lo.json`);
      const low = await readJson(`${base}/sheet_lo.json`);
      for (const image of Object.values(low.sheets || {})) {
        if (image.file) include(`${base}/${image.file}`);
      }
    }
    packed++;
  } else {
    // Some characters only have individual frames. Keep their runtime fallback.
    for (const clip of [anim.idle, anim.move, anim.die || anim.Die]) {
      for (const image of clip || []) if (typeof image === 'string') include(`${base}/${image}`);
    }
    fallback++;
  }
}

let bytes = 0;
for (const rel of files) {
  const info = await fs.stat(path.join(root, rel));
  if (!info.isFile()) throw new Error(`Asset is not a file: ${rel}`);
  if (info.size > 25 * 1024 * 1024) throw new Error(`Asset exceeds 25 MiB: ${rel}`);
  bytes += info.size;
}
if (files.size + 1 > 20000) throw new Error(`Asset count exceeds free plan limit: ${files.size + 1}`);

// Only this fixed, project-local generated folder is replaced.
if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Invalid output directory');
await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output);
for (const rel of [...files].sort()) {
  const target = path.join(output, rel);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(path.join(root, rel), target);
}
await fs.writeFile(path.join(output, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n');
console.log(`Cloudflare build: ${files.size + 1} files, ${(bytes / 1024 / 1024).toFixed(1)} MiB`);
console.log(`Animation sets: ${packed} atlases, ${fallback} frame fallbacks`);
console.log('Output: dist/ (development files and redundant source frames excluded)');
