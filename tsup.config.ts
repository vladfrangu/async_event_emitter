import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'tsup';

export default defineConfig({
	clean: true,
	dts: false,
	entry: ['src/index.ts'],
	format: ['cjs', 'esm', 'iife'],
	minify: false,
	skipNodeModulesBundle: true,
	sourcemap: true,
	target: 'es2020',
	tsconfig: 'src/tsconfig.json',
	keepNames: true,
	globalName: 'AsyncEventEmitter',
	plugins: [
		{
			name: 'add-unhandled-error-comments',
			async buildEnd(ctx) {
				for (const file of ctx.writtenFiles) {
					const { name } = file;

					if (!/\.m?js$/.test(name)) {
						continue;
					}

					const content = await readFile(resolve(process.cwd(), file.name), 'utf-8');

					const newContent = content.replace(/(?:throw (err?);)/g, (_, err) => {
						return `throw ${err}; // Unhandled 'error' event`;
					});

					await writeFile(resolve(process.cwd(), file.name), newContent, 'utf-8');
				}
			}
		}
	]
});
