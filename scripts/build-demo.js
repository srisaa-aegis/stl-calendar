// Bundles demo/main.ts and the library into demo/calendar.js. Open demo/index.html afterwards.
const esbuild = require('esbuild');
esbuild.buildSync({ entryPoints: ['demo/main.ts'], bundle: true, format: 'iife', sourcemap: true, outfile: 'demo/calendar.js' });
console.log('demo/calendar.js built - open demo/index.html');
