const esbuild = require('esbuild');

async function run() {
  try {
    await esbuild.build({
      entryPoints: ['./dist/index.js'],
      bundle: true,
      minify: true,
      format: 'iife',
      outfile: './dist/widget.js',
      allowOverwrite: true,
    });
    console.log('✅ Widget bundled successfully!');
  } catch (err) {
    console.error('❌ Bundling failed:', err);
    process.exit(1);
  }
}

run();
