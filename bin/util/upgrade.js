const fs = require('fs');

const { ExecUtil } = require('../../module/boot/src/exec');
const { FsUtil } = require('../../module/boot/src/fs');

/**
 * Take a monorepo module, and project out symlinks for all necessary dependencies
 * @param root {string}
 */
async function updateModule(root) {
  // Fetch deps
  /** @type {Record<string, Record<string, string>>} */ const pkg = require(`${root}/package.json`);

  process.stdout.write(`- ${pkg.name}`.padEnd(35));

  const resolved = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies', 'optionalPeerDependencies']
    .map(type =>
      Object.entries(pkg[type] ?? {})
        .map(([dep, version]) => ({ dep, type, version }))
    )
    .reduce((all, items) => all.concat(items), [])
    .filter(x => !x.dep.startsWith('@travetto'))
    .filter(x => /^[\^~<>]/.test(x.version)) // Rangeable
    .map(({ dep, type, version }) =>
      ExecUtil.spawn(`npm`, ['show', `${dep}@${version}`, 'version', '--json']).result.then(v => {
        const top = JSON.parse(v.stdout).pop();
        const curr = pkg[type][dep];
        const next = version.replace(/\d.*$/, top);
        if (next !== curr) {
          pkg[type][dep] = next;
          return `${dep}@(${curr} -> ${next})`;
        }
        return false;
      })
        .catch(() => false)
    );

  const updated = (await Promise.all(resolved)).filter(x => !!x);

  if (updated.length) {
    await fs.promises.writeFile(`${root}/package.json`, `${JSON.stringify(pkg, undefined, 2)}\n`, { encoding: 'utf8' });
  }

  process.stdout.write(`updated ${updated.length} dependencies - ${updated.join(', ') || 'None'}\n`);
}

/**
 * Main Entry point
 */
async function run() {
  const packages = (await ExecUtil.spawn(`npx`, ['lerna', 'ls', '-p', '-a']).result).stdout.split(/\n/)
    .filter(x => !!x && x.includes(FsUtil.cwd))
    .map(x => FsUtil.resolveUnix(x));

  // Finalize all modules
  console.log('Updating Modules');
  for (const pkg of packages) {
    await updateModule(pkg);
  }

  await updateModule(process.cwd());
}

module.exports = { run };

if (require.main === module) {
  run();
}