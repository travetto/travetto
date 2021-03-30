import * as  path from 'path';
import * as  fs from 'fs';

import '@arcsine/nodesh';

import { Packages } from './package/packages';

const commander = path.resolve('node_modules/commander/index.js');
const page = path.resolve.bind(path, 'related/travetto.github.io/src');

let target = process.argv[2];
const root = path.resolve(__dirname, '..');

if (target && target.startsWith(root)) {
  target = target.split(root)[1].split('/').pop()!;
}

// Update commander
[
  !target || target === 'todo-app' ?
    'Restarting Services'
      .$tap(console.log)
      .$map(() => {
        require('child_process').spawnSync('trv-service', ['restart'], { stdio: 'inherit', encoding: 'utf8' });
      }) : undefined,

  commander
    .$read()
    .$replace(/(process[.]stdout[.]columns \|\|).*;/g, (_, k) => `${k} 140;`)
    .$writeFinal(commander),

  target ? undefined :
    'Copying Plugin images'
      .$tap(console.log)
      .$map(() => fs.promises.mkdir(page('assets/images/vscode-plugin')).catch(err => { }))
      .$flatMap(() => 'related/vscode-plugin/images/**/*.{gif,jpg,png}'.$dir())
      .$map(img => fs.promises.copyFile(img, page(`assets/images/vscode-plugin/${path.basename(img)}`)).then(x => 1))
      .$collect(),

  [
    {
      mod: 'overview', title: 'Building out Overview docs', dir: 'related/overview',
      markdown: path.resolve(root, 'README.md'), mods: [],
      html: 'app/documentation/overview/overview.component.html'
    },
    {
      mod: 'todo-app', title: 'Building out Guide docs',
      dir: 'related/todo-app', mods: [],
      html: 'app/guide/guide.component.html'
    },
    {
      mod: 'vscode-plugin', title: 'Building out Plugin docs',
      dir: 'related/vscode-plugin', mods: [] as string[],
      html: 'app/documentation/vscode-plugin/vscode-plugin.component.html'
    },
  ]
    .$concat(
      Packages.yieldPublicPackages()
        .$filter(f => !f.name.includes('worker'))
        .$map(async (pkg) => {
          const mods = await `${pkg._.folder}/doc.ts`.$read()
            .$tokens(/@travetto\/[^/' `;\n]+/)
            .$filter(x => /^@[a-z\/0-9-]+$/.test(x) && x !== pkg.name)
            .$sort()
            .$unique();
          return {
            mod: pkg.name.split('/')[1],
            mods,
            title: `Building out ${pkg.name} docs`,
            html: 'app/documentation/gen/%MOD/%MOD.component.html',
            dir: pkg._.folder
          };
        })
    )
    .$filter(x => target ? x.mod === target : !x.mod.includes('worker'))
    .$parallel(
      ({ html, markdown, title, dir, mods }) =>
        title
          .$tap(console.log)
          .$exec('trv', {
            args: ['doc', '-o', page(html), '-o', markdown ?? './README.md'],
            spawn: {
              shell: true,
              detached: true,
              cwd: dir,
              env: {
                ...process.env,
                TRV_MODULES: (mods ?? []).join(',')
              }
            }
          })
          .$onError(() => {
            console.log(`${title}... failed`);
            return '';
          }),
      { concurrent: 4 }
    )
    .$notEmpty()
    .$tap(console.log)
]
  .$forEach(() => { });