import fs from 'fs/promises';

import { ExecUtil, FileQueryProvider } from '@travetto/base';
import { path, RootIndex } from '@travetto/manifest';
import { CliModuleUtil } from '@travetto/cli';

const page = (f: string): string => path.resolve('related/travetto.github.io/src', f);

const copyPluginImages = async (): Promise<void> => {
  console.log('Copying Plugin images');
  for await (const file of FileQueryProvider.query({
    paths: ['related/vscode-plugin/images'],
    filter: f => /[.](gif|jpe?g|png)/i.test(f)
  })) {
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

  const mods = new Set((await CliModuleUtil.findModules('all'))
    .filter(x => !target || x.source === path.resolve(root, target))
    .filter(x => (x.files.doc ?? []).some(f => f.source.endsWith('DOC.ts'))));

  if (mods.size > 1) {
    // Build out docs
    await CliModuleUtil.execOnModules('all',
      (mod, opts) => ExecUtil.spawn('trv', ['doc'], opts),
      {
        showStdout: false,
        progressMessage: mod => `Running 'trv doc' [%idx/%total] ${mod?.workspaceRelative ?? ''}`,
        progressPosition: 'inline',
        filter: mod => mods.has(mod)
      });
  } else {
    const opts = { env: { TRV_MANIFEST: '' }, cwd: [...mods][0].source, stdio: 'inherit' } as const;
    await ExecUtil.spawn('trv', ['doc'], opts).result;
  }

  for (const mod of mods) {
    if (mod.source.endsWith('vscode-plugin')) {
      await copyPluginImages();
    }
    const modName = mod.name.split('/')[1];
    try {
      let html = await fs.readFile(path.resolve(mod.source, 'DOC.html'), 'utf8');

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