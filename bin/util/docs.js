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
    .$exec('npm', { args: ['run', 'service', 'resetart', 'mongodb'], singleValue: true })
    .$collect(),

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
    )
    .$collect(),

  'Building out Guide docs'
    .$tap(console.log)
    .$exec('trv', {
      args: ['doc', '-o', page('guide/guide.component.html'), '-o', './README.md'],
      spawn: {
        cwd: 'related/todo-app',
        env: { ...process.env, TRV_SRC_LOCAL: 'doc', TRV_RESOURCES: 'doc/resources' }
      }
    })
    .$tap(console.log)
    .$collect(),

  'Building out Guide docs'
    .$tap(console.log)
    .$exec('trv', {
      args: ['doc', '-o', page('app/documentation/vscode-plugin/vscode-plugin.component.html'), '-o', './README.md'],
      spawn: {
        cwd: 'related/vscode-plugin',
        env: { ...process.env, TRV_SRC_LOCAL: 'doc', TRV_RESOURCES: 'doc/resources' }
      }
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
    .$flatMap(() => 'module/*/DOCS.js'.$dir())
    .$parallel(f =>
      $exec('trv', {
        args: [
          'doc',
          '-o', page('app/documentation/gen/%MOD/%MOD.component.html'),
          '-o', './README.md'
        ],
        spawn: {
          cwd: path.dirname(f),
          env: { ...process.env, TRV_SRC_LOCAL: 'doc', TRV_RESOURCES: 'doc/resources' }
        }
      }), {
      concurrent: 1
    }
    )
    .$tap(console.log)
].$forEach(() => { })
