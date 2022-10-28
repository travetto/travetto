const path = require('path');
const fs = require('fs');

const FOLDER = path.resolve(__dirname, '..');
const FILES = ['src', 'support/bin', 'support/init.ts', 'index.ts']
  .flatMap(sub =>
    sub.endsWith('.ts') ?
      [`./${sub}`] :
      fs.readdirSync(`${FOLDER}/${sub}`)
        .filter(x => !x.startsWith('.'))
        .map(x => `./${sub}/${x}`)
  );

/**
 * @param {fs.Stats} stat
 */
const recent = stat => Math.max(stat.ctimeMs, stat.mtimeMs);

function shouldBootstrap(folder, files) {
  for (const f of files) {
    const source = path.resolve(folder, f);
    try {
      const targetStat = fs.statSync(source.replace(/[.]ts$/, '.js'));
      const sourceStat = fs.statSync(source);
      if (recent(sourceStat) > recent(targetStat)) {
        return true;
      }
    } catch {
      return true;
    }
  }
  return false;
}

function bootstrap(folder, files) {
  const cmd = require.resolve('typescript').replace(/(node_modules\/typescript)\/.*$/, (_, s) => `${s}/bin/tsc`);
  const args = [
    '--outDir', folder,
    '-t', 'es2022',
    '--lib', 'es2022',
    '-m', 'commonjs',
    '--importHelpers',
    '--rootDir', folder,
    '--strict',
    '--skipLibCheck',
    ...files
  ];
  require('child_process').spawnSync(cmd, args, { cwd: folder });
}

function relativeDelta(outputFolder, inputManifest = `${outputFolder}/manifest.json`) {
  if (shouldBootstrap(FOLDER, FILES)) {
    bootstrap(FOLDER, FILES);
  }
  const { ManifestUtil } = require('../../manifest/src/util');
  return ManifestUtil.produceRelativeDelta(outputFolder, inputManifest);
}

module.exports = { bootstrap, relativeDelta };

if (require.main === module) {
  console.log(relativeDelta('.trv_compiler', 'manifest.json'))
}