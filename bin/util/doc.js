#!/usr/bin/env -S npx @arcsine/nodesh
/// @ts-check
/// <reference types="/tmp/npx-scripts/arcsine.nodesh" lib="npx-scripts" />

const path = require('path');
const fs = require('fs');

const commander = path.resolve('node_modules/commander/index.js');
const page = (p) => path.resolve(`related/travetto.github.io/src/${p}`);

let target = $argv[0];
const root = path.resolve(__dirname, '..', '..');
if (target && target.startsWith(root)) {
  target = target.split(root)[1].split('/').pop();
}

// Update commander
[
  !target ?
    'Restarting Services'
      .$tap(console.log)
      .$map(() => {
        require('child_process').spawnSync('npm', ['run', 'util:service', 'restart'], { stdio: 'inherit', encoding: 'utf8' });
      }) : undefined,

  commander
    .$read()
    .$replace(/(process[.]stdout[.]columns \|\|).*;/g, (_, k) => `${k} 140;`)
    .$writeFinal(commander),

  target ? undefined :
    'Building out Overview docs'
      .$tap(console.log)
      .$map(() =>
        // Overview
        `<div class="documentation">`
          .$concat(
            $exec('npx', ['marked', '--gfm', 'README.md'])
              .$filter(x => !/<p.*<img/.test(x) && !/<sub/.test(x)),
          )
          .$concat(['</div>\n<app-module-chart></app-module-chart>'])
          .$write(page('app/documentation/overview/overview.component.html'))
      ),

  target ? undefined :
    'Copying Plugin images'
      .$tap(console.log)
      .$map(() => fs.promises.mkdir(page('assets/images/vscode-plugin')).catch(err => { }))
      .$flatMap(() => 'related/vscode-plugin/images/**/*.{jpg,png}'.$dir())
      .$map(img => fs.promises.copyFile(img, page(`assets/images/vscode-plugin/${path.basename(img)}`)).then(x => 1))
      .$collect(),

  [
    { mod: 'todo-app', html: 'app/guide/guide.component.html', title: 'Building out Guide docs', dir: 'related/todo-app', mods: [] },
    { mod: 'vscode-plugin', html: 'app/documentation/vscode-plugin/vscode-plugin.component.html', title: 'Building out Plugin docs', dir: 'related/vscode-plugin', mods: [] },
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
            dir: path.dirname(f)
          };
        })
    )
    .$filter(x => target ? x.mod === target : !x.mod.includes('worker'))
    .$parallel(
      ({ mod, html, title, dir, mods }) =>
        title
          .$tap(console.log)
          .$exec('trv', {
            args: ['doc', '-o', page(html), '-o', './README.md'],
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
].$forEach(() => { });
