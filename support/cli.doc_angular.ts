import fs from 'fs/promises';

import { ExecUtil, FileQueryProvider } from '@travetto/base';
import { path, RootIndex } from '@travetto/manifest';
import { CliCommand, CliModuleUtil } from '@travetto/cli';

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

/**
 * Generate documentation into the angular webapp under related/travetto.github.io
 */
@CliCommand()
export class DocAngularCommand {
  async main(target?: string): Promise<void> {
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
      .filter(x => !target || x.sourcePath === path.resolve(root, target))
      .filter(x => (x.files.doc ?? []).some(f => /DOC[.]tsx?$/.test(f.sourceFile))));

    if (mods.size > 1) {
      // Build out docs
      await CliModuleUtil.execOnModules('all',
        (mod, opts) => ExecUtil.spawn('trv', ['doc'], { ...opts, env: { ...opts.env ?? {}, TRV_BUILD: 'none' } }),
        {
          showStdout: false,
          progressMessage: mod => `Running 'trv doc' [%idx/%total] ${mod?.sourceFolder ?? ''}`,
          progressPosition: 'bottom',
          filter: mod => mods.has(mod)
        });
      await ExecUtil.spawn('trv', ['doc'], { env: { TRV_MANIFEST: '' }, cwd: RootIndex.mainModule.sourcePath, stdio: 'pipe' }).result;
      mods.add(RootIndex.mainModule);
    } else {
      const opts = { env: { TRV_MANIFEST: '', TRV_BUILD: 'none' }, cwd: [...mods][0].sourcePath, stdio: 'inherit' } as const;
      await ExecUtil.spawn('trv', ['doc'], opts).result;
    }

    for (const mod of mods) {
      if (mod.sourceFolder.endsWith('vscode-plugin')) {
        await copyPluginImages();
      }
      const modName = mod.name.endsWith('mono-repo') ? 'overview' : mod.name.split('/')[1];
      try {
        let html = await fs.readFile(path.resolve(mod.sourcePath, 'DOC.html'), 'utf8');

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
}