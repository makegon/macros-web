import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function inlineAssetsForFileProtocol() {
  let outDir = 'dist';

  return {
    name: 'inline-assets-for-file-protocol',
    apply: 'build' as const,
    configResolved(config: { root: string; build: { outDir: string } }) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const indexPath = resolve(outDir, 'index.html');

      if (!existsSync(indexPath)) {
        return;
      }

      const html = readFileSync(indexPath, 'utf8')
        .replace(
          /<script type="module" crossorigin src="\.\/([^"]+\.js)"><\/script>/g,
          (_tag, fileName: string) => {
            const scriptPath = resolve(outDir, fileName);
            const script = readFileSync(scriptPath, 'utf8');
            return `<script type="module">\n${script}\n</script>`;
          },
        )
        .replace(
          /<link rel="stylesheet" crossorigin href="\.\/([^"]+\.css)">/g,
          (_tag, fileName: string) => {
            const stylePath = resolve(outDir, fileName);
            const style = readFileSync(stylePath, 'utf8');
            return `<style>\n${style}\n</style>`;
          },
        );

      writeFileSync(indexPath, html);
      rmSync(resolve(outDir, 'assets'), { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), inlineAssetsForFileProtocol()],
});
