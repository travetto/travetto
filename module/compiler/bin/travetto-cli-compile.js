const fs = require('fs');
const path = require('path');

module.exports = function init(program, cwd, dependOn) {
  return program
    .command('compile')
    .option('-o, --output <output>', 'Output directory')
    .option('-r, --runtime-dir [runtimeDir]', 'Expected path during runtime')
    .action(async (cmd) => {

      dependOn('clean');

      // Bootstrap
      process.env.WATCH = false;

      await require(`@travetto/base/bin/bootstrap`).run();
      const { ScanApp, FsUtil } = require(`@travetto/base/src`);
      const { AppCache } = require(`@travetto/base/src/cache`);

      // TODO: Need to refine this
      // Collect all files to force compilation
      const files = ScanApp.findFiles('.ts', x =>
        // Allow specific files
        (
          x.endsWith('index.ts') ||
          (
            (x.includes('src/') || x.includes('support/')) &&
            !x.endsWith('.d.ts')
          )
        )
      ).filter(x => !x.file.includes('@travetto/test'));

      // Require them
      for (const f of files) {
        require(f.file);
      }

      // Clear out cache if specified
      if (cmd.output) {
        try {
          require('child_process').execSync(`rm -rf ${path.resolve(cwd, cmd.output)}`)
        } catch (e) {
          // Ignore
        }
        await FsUtil.mkdirp(cmd.output);
      }

      // Find final destination
      let outDir = path.resolve(cwd, cmd.output || AppCache.cacheDir);

      const FILES = `ScanApp.setFileEntries('ts', [${files.map(x =>`'${x.module.replace(/node_modules\/@travetto/g, '#')}'`).join(', ')}])`;

      // Rewrite files to allow for presume different path
      for (const f of fs.readdirSync(AppCache.cacheDir)) {
        const inp = path.resolve(AppCache.cacheDir, f);
        const out = path.resolve(outDir, f);

        let contents = fs.readFileSync(inp).toString();
        contents = contents.replace('ScanApp.cache = {}', x => `${x};\n${FILES}`);
        contents = contents.replace(new RegExp(cwd, 'g'), cmd.runtimeDir || process.cwd());
        fs.writeFileSync(out, contents);
      }
    });
};