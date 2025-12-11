import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// package.jsonからバージョンを取得
const packageJson = JSON.parse(
	readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8')
);

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	define: {
		// package.jsonのバージョンをグローバル定数として注入
		__APP_VERSION__: JSON.stringify(packageJson.version || 'dev'),
	},
});
