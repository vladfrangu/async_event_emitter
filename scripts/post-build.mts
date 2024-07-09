import { copyFile, readFile, writeFile } from 'node:fs/promises';

const originalDTS = new URL('../dist/index.d.ts', import.meta.url);
const originalDTSMap = new URL('../dist/index.d.ts.map', import.meta.url);

const esmDTS = new URL('../dist/index.d.mts', import.meta.url);
const esmDTSMap = new URL('../dist/index.d.mts.map', import.meta.url);

await copyFile(originalDTS, esmDTS);

const readMap = await readFile(originalDTSMap, 'utf-8');
const parsedMap = JSON.parse(readMap);
parsedMap.file = 'index.d.mts';

await writeFile(esmDTSMap, JSON.stringify(parsedMap), 'utf-8');
