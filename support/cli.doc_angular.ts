import fs from 'node:fs/promises';

import { Env, ExecUtil } from '@travetto/base';
import { path, RuntimeIndex, RuntimeContext } from '@travetto/manifest';
import { CliCommand, CliModuleUtil } from '@travetto/cli';
import { RepoExecUtil } from '@travetto/repo';


const page = (f: string): string => path.resolve('related/travetto.github.io/src', f);

/**
 * Generate documentation into the angular webapp under related/travetto.github.io
 */
@CliCommand()
export class DocAngularCommand {
  async main(target?: string): Promise<void> {
    const root = RuntimeContext.workspace.path;

    if (target && target.startsWith(root)) {
      target = target.replace(root, '').split('/').pop()!;
    }

    const mods = new Set((await CliModuleUtil.findModules('all'))
      .filter(x => !target || x.sourcePath === path.resolve(root, target))
      .filter(x => (x.files.doc ?? []).some(f => /DOC[.]tsx?$/.test(f.sourceFile))));

    if (mods.size > 1) {
      // Build out docs
      await RepoExecUtil.execOnModules('all',
        (mod, opts) => {
          const req = ExecUtil.spawn('trv', ['doc'], {
            ...opts,
            timeout: 20000,
            env: {
              ...process.env,
              ...opts.env ?? {},
              ...Env.TRV_BUILD.export('none')
            }
          });
          req.complete.then(v => {
            if (!v.valid) {
              console.error(`${mod.name} - failed`);
            }
          });
          return req;
        },
        {
          showStdout: false,
          progressMessage: mod => `Running 'trv doc' [%idx/%total] ${mod?.sourceFolder ?? ''}`,
          filter: mod => mods.has(mod)
        });
      await ExecUtil.spawn('trv', ['doc'], { env: { ...Env.TRV_MANIFEST.export('') }, cwd: RuntimeIndex.mainModule.sourcePath, stdio: 'pipe' }).result;
      mods.add(RuntimeIndex.mainModule);
    } else {
      const opts = {
        env: { ...Env.TRV_MANIFEST.export(''), ...Env.TRV_BUILD.export('none') },
        cwd: [...mods][0].sourcePath, stdio: 'inherit'
      } as const;
      await ExecUtil.spawn('trv', ['doc'], opts).result;
    }

    for (const mod of mods) {
      const modName = mod.name.endsWith('mono-repo') ? 'overview' : mod.name.split('/')[1];
      try {
        let html = await fs.readFile(path.resolve(mod.sourcePath, 'DOC.html'), 'utf8');

        html = html
          .replace(/href="[^"]+travetto\/tree\/[^/]+\/module\/([^/"]+)"/g, (_, ref) => `routerLink="/docs/${ref}"`)
          .replace(/^src="images\//g, `src="/assets/images/${modName}/`)
          .replace(/(href|src)="https?:\/\/travetto.dev\//g, (_, attr) => `${attr}="/`)
          .replaceAll('@', '&#64;')
          .replaceAll('process.env.NODE_ENV', x => x.replaceAll('.', '\u2024'));

        if (modName === 'todo-app') {
          html = html
            .replace(/(<h1>(?:[\n\r]|.)*)(<h2.*?\s*<ol>(?:[\r\n]|.)*?<\/ol>)((?:[\r\n]|.)*)/m,
              (_, h, toc, text) => `<div class="toc"><div class="inner">${toc.trim()}</div></div>\n<div class="documentation">\n${h}\n${text}\n</div>\n`);
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