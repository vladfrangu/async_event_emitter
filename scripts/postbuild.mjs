// Forgive me father, for I have sinned to fix this issue
import { readFile, writeFile } from 'node:fs/promises';

const contentToFindAndTSIgnore = ['static once<', 'static on<'];

const filePaths = [new URL('../dist/index.d.mts', import.meta.url), new URL('../dist/index.d.ts', import.meta.url)];

for (const filePath of filePaths) {
	const fileContent = await readFile(filePath, 'utf8');

	const lines = fileContent.split('\n');
	const newLines = [];

	for (const line of lines) {
		for (const contentToFind of contentToFindAndTSIgnore) {
			if (line.includes(contentToFind)) {
				newLines.push('    // @ts-ignore');
				break;
			}
		}

		newLines.push(line);
	}

	await writeFile(filePath, newLines.join('\n'));
}
