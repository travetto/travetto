import fs from 'fs/promises';

import { ExecUtil, FileResourceProvider } from '@travetto/base';
import { path, RootIndex } from '@travetto/manifest';
import { CliModuleUtil } from '@travetto/cli';

const page = (f: string): string => path.resolve('related/travetto.github.io/src', f);

const copyPluginImages = async (): Promise<void> => {
  console.log('Copying Plugin images');
  const provider = new FileResourceProvider(['related/vscode-plugin/images']);

  for (const file of await provider.query(f => /[.](gif|jpe?g|png)/i.test(f))) {
    const target = page(`assets/images/vscode-plugin${file.split('vscode-plugin/images')[1]}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(file, target);
  }
};

export async function main(target?: string): Promise<void> {
  const root = RootIndex.manifest.workspacePath;

  if (target && target.startsWith(root)) {
    target = target.replace(root, '').split('/').pop()!;
  }

  // Restart services
  if (!target || target === 'todo-app') {
    console.log!('Restarting Services');
    await (ExecUtil.spawn('trv', ['service', 'restart'], { stdio: 'inherit' }).result);
  }

  const mods = (await CliModuleUtil.findModules('all'))
    .filter(x => !target || x.source === path.resolve(root, target))
    .filter(x => (x.files.doc ?? []).some(f => f.source.endsWith('README.ts')));

  const modSrc = new Set(mods.map(x => x.workspaceRelative));

  // Build out docs
  await CliModuleUtil.runOnModules('all', ['trv', 'doc'], {
    showProgress: true,
    showStdout: false,
    progressBar: 'inline',
    filter: folder => modSrc.has(folder)
  });

  for (const mod of mods) {
    if (mod.source.endsWith('vscode-plugin')) {
      await copyPluginImages();
    }
    const modName = mod.name.split('/')[1];
    try {
      let html = await fs.readFile(path.resolve(mod.source, 'README.html'), 'utf8');

      html = html
        .replace(/href="[^"]+travetto\/tree\/[^/]+\/module\/([^/"]+)"/g, (_, ref) => `routerLink="/docs/${ref}"`)
        .replace(/^src="images\//g, `src="/assets/images/${modName}/`)
        .replace(/(href|src)="https?:\/\/travetto.dev\//g, (_, attr) => `${attr}="/`);

      if (modName === 'todo-app') {
        html = html
          .replace(/(<h1>(?:[\n\r]|.)*)(\s*<div class="toc">(?:[\r\n]|.)*?<\/div>(?:[\r\n]|.)*?<\/div>\s*)((?:[\r\n]|.)*)/m,
            (_, h, toc, text) => `${toc.trim()}\n<div class="documentation">\n${h}\n${text}\n</div>\n`);
      }

      await fs.writeFile(page(`app/documentation/gen/${modName}/${modName}.component.html`), html, 'utf8');
    } catch (err) {
      if (err instanceof Error) {
        console.error(`${mod.name}: ${err.message}`);
      }
    }
  }
}