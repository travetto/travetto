#!/usr/bin/env -S npx @arcsine/nodesh
/// @ts-check
/// <reference types="/tmp/npx-scripts/arcsine.nodesh" lib="npx-scripts" />

const path = require('path');
const fs = require('fs');

const commander = path.resolve('node_modules/commander/index.js');
const page = (p) => path.resolve(`related/travetto.github.io/src/${p}`);

// Update commander
[
  commander
    .$read()
    .$replace(/(process[.]stdout[.]columns \|\|).*;/g, (_, k) => `${k} 140;`)
    .$writeFinal(commander),

  'Restarting Mongodb'
    .$tap(console.log)
    .$map(() =>
      require('child_process').spawnSync('npm', ['run', 'service', 'restart', 'mongodb'], { stdio: 'inherit', encoding: 'utf8' })
    ),

  'Building out Overview docs'
    .$tap(console.log)
    .$map(() =>
      // Overview
      `<div class="documentation">`
        .$concat(
          $exec('npx', ['markdown-to-html', '--flavor', 'gfm', 'README.md'])
            .$filter(x => !/<p.*<img/.test(x) && !/<sub/.test(x)),
        )
        .$concat([
          `</div>
          <app-module-chart></app-module-chart>`
        ])
        .$write(page('app/documentation/overview/overview.component.html'))
    ),

  'Building out Guide docs'
    .$tap(console.log)
    .$exec('trv', {
      args: ['doc', '-o', page('app/guide/guide.component.html'), '-o', './README.md'],
      spawn: { cwd: 'related/todo-app' }
    })
    .$tap(console.log)
    .$collect(),

  'Building out Plugin docs'
    .$tap(console.log)
    .$exec('trv', {
      args: ['doc', '-o', page('app/documentation/vscode-plugin/vscode-plugin.component.html'), '-o', './README.md'],
      spawn: { cwd: 'related/vscode-plugin' }
    })
    .$tap(console.log)
    .$collect(),

  'Copying Plugin images'
    .$tap(console.log)
    .$map(() => fs.promises.mkdir(page('assets/images/vscode-plugin')).catch(err => { }))
    .$flatMap(() => 'related/vscode-plugin/images/**/*.{jpg,png}'.$dir())
    .$map(img => fs.promises.copyFile(img, page(`assets/images/vscode-plugin/${path.basename(img)}`)).then(x => 1))
    .$collect(),

  'Building out Module docs'
    .$tap(console.log)
    .$flatMap(() => 'module/*/doc.ts'.$dir())
    .$parallel(
      async f => {
        const mod = f.replace(/^(.*module|related)\/([^/]+)(.*)$/, (_, a, b) => `@travetto/${b}`);
        const mods = await f.$read()
          .$tokens(/@travetto\/[^/' `;\n]+/)
          .$filter(x => /^@[a-z\/0-9]+$/.test(x) && x !== mod)
          .$sort()
          .$unique();

        console.log('Documenting', mod, mods);

        return $exec('trv', {
          args: [
            'doc',
            '-o', page('app/documentation/gen/%MOD/%MOD.component.html'),
            '-o', './README.md'
          ],
          spawn: {
            shell: true,
            detached: true,
            cwd: path.dirname(f),
            env: {
              ...process.env,
              TRV_MODULES: mods.join(',')
            }
          }
        })
      },
      {
        concurrent: 6
      }
    )
    .$notEmpty()
    .$tap(console.log)
].$forEach(() => { })
