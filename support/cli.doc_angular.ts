import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

import { Env, ExecUtil, Runtime, RuntimeIndex } from '@travetto/runtime';
import { CliCommand, CliModuleUtil } from '@travetto/cli';
import { RepoExecUtil } from '@travetto/repo';


const page = (f: string): string => path.resolve('related/travetto.github.io/src', f);

/**
 * Generate documentation into the angular webapp under related/travetto.github.io
 */
@CliCommand()
export class DocAngularCommand {
  async main(target?: string): Promise<void> {
    const root = Runtime.workspace.path;

    if (target && target.startsWith(root)) {
      target = target.replace(root, '').split('/').pop()!;
    }

    const mods = new Set((await CliModuleUtil.findModules('all'))
      .filter(x => !target || x.sourcePath === path.resolve(root, target))
      .filter(x => (x.files.doc ?? []).some(f => /DOC[.]tsx?$/.test(f.sourceFile))));

    if (mods.size > 1) {
      // Build out docs
      await RepoExecUtil.execOnModules('all',
        mod => {
          const proc = spawn('trv', ['doc'], {
            timeout: 20000,
            cwd: mod.sourceFolder,
            shell: false,
            env: {
              ...process.env,
              ...Env.TRV_MODULE.export(mod.name),
              ...Env.TRV_MANIFEST.export(undefined),
              ...Env.TRV_BUILD.export('none')
            }
          });

          ExecUtil.getResult(proc).catch(() => console.error(`${mod.name} - failed`));

          return proc;
        },
        {
          showStdout: false,
          progressMessage: mod => `Running 'trv doc' [%idx/%total] ${mod?.sourceFolder ?? ''}`,
          filter: mod => mods.has(mod)
        });
      await ExecUtil.getResult(spawn('trv', ['doc'], { env: { ...process.env, ...Env.TRV_MANIFEST.export('') }, cwd: Runtime.mainSourcePath }));
      mods.add(RuntimeIndex.mainModule);
    } else {
      await ExecUtil.getResult(spawn('trv', ['doc'], {
        env: { ...process.env, ...Env.TRV_MANIFEST.export(''), ...Env.TRV_BUILD.export('none') },
        cwd: [...mods][0].sourcePath,
        stdio: 'inherit'
      }));
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