// Rigenera index.html da content.json (uso: node tools/build.mjs). La dashboard fa la stessa cosa al momento di pubblicare.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { renderPage } from '../admin/render.js';
const root = new URL('../', import.meta.url);
const read = p => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const schema = read('admin/schema.json');
const defaultSizes = read('admin/default-sizes.json');
const saved = existsSync(new URL('content.json', root)) ? read('content.json') : {};
writeFileSync(new URL('index.html', root), renderPage(schema, saved, { defaultSizes }));
console.log('index.html generato');
