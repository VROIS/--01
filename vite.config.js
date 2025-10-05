import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: 'public',
  publicDir: false,
  build: {
    outDir: '../dist/public',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'public/index.html'),
      },
    },
    copyPublicDir: false,
  },
  server: {
    port: 5173,
  },
  plugins: [
    {
      name: 'copy-static-files',
      writeBundle() {
        const filesToCopy = [
          'service-worker.js',
          'manifest.json',
          'share.html',
          'index.js',
          'share-page.js',
          'geminiService.js',
          'imageOptimizer.js',
          'performanceMonitor.js',
          'generate-standalone.js',
          'tailwind.css'
        ];
        
        filesToCopy.forEach(file => {
          const src = path.resolve(__dirname, 'public', file);
          const dest = path.resolve(__dirname, 'dist/public', file);
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
          }
        });
        
        const assetsDir = path.resolve(__dirname, 'public/assets');
        const destAssetsDir = path.resolve(__dirname, 'dist/public/assets');
        if (fs.existsSync(assetsDir)) {
          if (!fs.existsSync(destAssetsDir)) {
            fs.mkdirSync(destAssetsDir, { recursive: true });
          }
          fs.readdirSync(assetsDir).forEach(file => {
            fs.copyFileSync(
              path.join(assetsDir, file),
              path.join(destAssetsDir, file)
            );
          });
        }
      }
    }
  ],
});
