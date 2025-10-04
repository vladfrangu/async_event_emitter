import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Options, defineConfig } from 'tsup';

const sharedConfig: Options = {
	entry: ['src/index.ts'],
	external: [],
	noExternal: ['node-inspect-extracted'],
	platform: 'neutral',
	target: 'es2020',
	skipNodeModulesBundle: true,
	clean: true,
	shims: true,
	cjsInterop: true,
	minify: false,
	terserOptions: {
		mangle: false,
		keep_classnames: true,
		keep_fnames: true,
	},
	splitting: false,
	keepNames: true,
	dts: true,
	sourcemap: true,
	treeshake: false,
	outDir: 'dist',
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
			},
		},
	],
};

export default [
	defineConfig({
		...sharedConfig,
		format: 'cjs',
		outExtension: () => ({ js: '.cjs' }),
	}),
	defineConfig({
		...sharedConfig,
		format: 'esm',
	}),
	defineConfig({
		...sharedConfig,
		format: 'iife',
	}),
];
