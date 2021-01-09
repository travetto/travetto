const fs = require('fs');

const { FsUtil } = require('../../module/boot/src/fs');
const { ExecUtil } = require('../../module/boot/src/exec');

const commander = FsUtil.resolveUnix('node_modules/commander/index.js');

function page(p) {
  return FsUtil.resolveUnix(`related/travetto.github.io/src/${p}`);
}

async function run() {

  console.log('Updating commander for worker activities');
  fs.writeFileSync(
    commander,
    fs.readFileSync(commander, 'utf8')
      .replace(/(process[.]stdout[.]columns \|\|).*;/g, (_, k) => `${k} ${process.stdout.getWindowSize()[0]};`)
  );

  // Startup mongo
  console.log('Restarting Mongodb');
  await ExecUtil.spawn(
    'npm',
    ['run', 'service', 'restart', 'mongodb'],
    { stdio: 'pipe' }
  ).result;

  console.log('Building out Overview docs');
  const res = (await (await ExecUtil.spawn(
    'npx',
    ['markdown-to-html', '--flavor', 'gfm', 'README.md']
  )).result).stdout;

  fs.writeFileSync(page('app/documentation/overview/overview.component.html'),
    `<div class="documentation">
      ${res
      .split(/\n/g)
      .filter(x => !/<p.*<img/.test(x) && !/<sub/.test(x))
      .join('\n')
    }
      </div>
      <app-module-chart></app-module-chart>`
  );

  console.log('Building out Guide docs');
  await ExecUtil.spawn(
    'trv', ['doc', '-o', page('guide/guide.component.html'), '-o', './README.md'],
    {
      cwd: FsUtil.resolveUnix('related/todo-app'),
      stdio: [0, 1, 2]
    }
  ).result;

  console.log('Building out Plugin docs');
  await ExecUtil.spawn(
    'trv', ['doc', '-o', page('app/documentation/vscode-plugin/vscode-plugin.component.html'), '-o', './README.md'],
    {
      cwd: FsUtil.resolveUnix('related/vscode-plugin'),
      stdio: [0, 1, 2]
    }
  ).result;

  console.log('Copying Plugin images');
  await FsUtil.mkdirp(page('assets/images/vscode-plugin'));
  await FsUtil.copyRecursiveSync(FsUtil.resolveUnix('related/vscode-plugin/images'), page('assets/images/vscode-plugin'));

  console.log('Building out Module docs');
  await ExecUtil.spawn(
    'npx',
    [
      'lerna', 'exec',
      '--no-sort', '--stream',
      '--no-bail', '--no-private',
      '--',
      'trv', 'doc',
      '-o', page('app/documentation/gen/%MOD/%MOD.component.html'),
      '-o', './README.md'
    ],
    { stdio: [0, 1, 2] }
  ).result;
}

run();