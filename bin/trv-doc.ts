import * as path from 'path';
import * as fs from 'fs';
import { spawnSync } from 'child_process';

import '@arcsine/nodesh';

import { PathUtil } from '@travetto/boot/src';
import { Packages } from './package/packages';

const page = (f: string) =>
  PathUtil.resolveUnix('related/travetto.github.io/src', f);

let [, , target] = process.argv;
const root = path.resolve(__dirname, '..');

if (target && target.startsWith(root)) {
  target = target.replace(root, '').split('/').pop()!;
}

const copyPluginImages = async () => {
  console.log('Copying Plugin images');
  await fs.promises.mkdir(page('assets/images/vscode-plugin')).catch(() => { });
  await 'related/vscode-plugin/images/**/*.{gif,jpg,png}'.$dir()
    .$map(img => fs.promises.copyFile(img, page(`assets/images/vscode-plugin/${path.basename(img)}`)).then(x => 1))
    .$collect();
};

const htmlPage = (mod: string) =>
  page(({
    overview: 'app/documentation/overview/overview.component.html',
    'todo-app': 'app/guide/guide.component.html',
    'vscode-plugin': 'app/documentation/vscode-plugin/vscode-plugin.component.html'
  })[mod] ?? `app/documentation/gen/${mod}/${mod}.component.html`);

const markdownPage = (mod: string) =>
  ({ 'overview': PathUtil.resolveUnix('README.md') })[mod] ?? './README.md';

[
  !target || target === 'todo-app' ?
    'Restarting Services'
      .$tap(console.log)
      .$map(() => {
        spawnSync('trv-service', ['restart'], { stdio: 'inherit', encoding: 'utf8' });
      }) : undefined,

  Packages.yieldByFolder('related/overview').$concat(
    Packages.yieldByFolder('related/todo-app'),
    Packages.yieldByFolder('related/vscode-plugin'),
    Packages.yieldPublicPackages()
  )
    .$filter(x => !target || (x._.mod === target))
    .$parallel(async pkg => {
      console.log(`Building out docs for ${pkg.name}`);
      if (pkg._.folder.endsWith('vscode-plugin')) {
        await copyPluginImages();
      }

      return $exec('trv', {
        args: ['doc', '-o', htmlPage(pkg._.mod), '-o', markdownPage(pkg._.mod)],
        spawn: {
          shell: true,
          detached: true,
          cwd: pkg._.folder,
          env: process.env
        }
      })
        .then(() => { }, () => console.log(`${pkg.name}... failed`));
    }, { concurrent: 4 })
]
  .$forEach(() => { });