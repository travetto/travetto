#!/usr/bin/env -S npx @arcsine/nodesh
/// @ts-check
/// <reference types="/tmp/npx-scripts/arcsine.nodesh" lib="npx-scripts" />

const path = require('path');
const fs = require('fs');

const commander = path.resolve('node_modules/commander/index.js');
const page = path.resolve.bind(path, 'related/travetto.github.io/src');

let target = $argv[0];
const root = path.resolve(__dirname, '..');
if (target && target.startsWith(root)) {
  target = target.split(root)[1].split('/').pop();
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
      mods: [], args: ['-o', path.resolve(root, 'README.md')],
      html: 'app/documentation/overview/overview.component.html'
    },
    {
      mod: 'todo-app', title: 'Building out Guide docs', dir: 'related/todo-app',
      mods: [], args: [],
      html: 'app/guide/guide.component.html'
    },
    {
      mod: 'vscode-plugin', title: 'Building out Plugin docs', dir: 'related/vscode-plugin',
      mods: [], args: [],
      html: 'app/documentation/vscode-plugin/vscode-plugin.component.html'
    },
  ]
    .$concat(
      'module/*/doc.ts'.$dir()
        .$filter(f => !f.includes('worker'))
        .$map(async f => {
          const mod = f.replace(/^(.*module|related)\/([^/]+)(.*)$/, (_, a, b) => `@travetto/${b}`);
          const mods = await f.$read()
            .$tokens(/@travetto\/[^/' `;\n]+/)
            .$filter(x => /^@[a-z\/0-9-]+$/.test(x) && x !== mod)
            .$sort()
            .$unique();
          return {
            mod: mod.split('/')[1],
            mods,
            title: `Building out ${mod} docs`,
            html: 'app/documentation/gen/%MOD/%MOD.component.html',
            args: [],
            dir: path.dirname(f)
          };
        })
    )
    .$filter(x => target ? x.mod === target : !x.mod.includes('worker'))
    .$parallel(
      ({ mod, html, title, dir, mods, args }) =>
        title
          .$tap(console.log)
          .$exec('trv', {
            args: ['doc', '-o', page(html), '-o', './README.md', ...args],
            spawn: {
              shell: true,
              detached: true,
              cwd: dir,
              env: {
                ...process.env,
                TRV_MODULES: mods.join(',')
              }
            }

          }),
      { concurrent: 4 }
    )
    .$notEmpty()
    .$tap(console.log)
]
  .$forEach(() => { });
