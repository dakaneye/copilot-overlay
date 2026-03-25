import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, existsSync } from 'node:fs';

const isWatch = process.argv.includes('--watch');

// Ensure dist directory exists
if (!existsSync('dist')) {
  mkdirSync('dist', { recursive: true });
}

// Copy static files
const staticFiles = [
  ['manifest.json', 'dist/manifest.json'],
  ['src/popup.html', 'dist/popup.html'],
  ['src/settings.html', 'dist/settings.html'],
  ['styles', 'dist/styles'],
  ['icons', 'dist/icons'],
];

for (const [src, dest] of staticFiles) {
  if (existsSync(src)) {
    cpSync(src, dest, { recursive: true });
  }
}

// Build configuration
const buildOptions = {
  entryPoints: [
    'src/background.js',
    'src/content.js',
    'src/popup.js',
    'src/settings.js',
  ],
  bundle: true,
  outdir: 'dist',
  format: 'esm',
  target: 'chrome91',
  sourcemap: isWatch ? 'inline' : false,
  minify: !isWatch,
};

if (isWatch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await esbuild.build(buildOptions);
  console.log('Build complete!');
}
