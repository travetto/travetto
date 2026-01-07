import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

import { Env, ExecUtil, Runtime, RuntimeIndex } from '@travetto/runtime';
import { CliCommand, CliModuleUtil } from '@travetto/cli';
import { RepoExecUtil } from '@travetto/repo';
import { path } from '@travetto/manifest';

const page = (file: string): string => path.resolve('related/travetto.github.io/src', file);

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

    const mods = new Set((await CliModuleUtil.findModules('workspace'))
      .filter(mod => !target || mod.sourcePath === path.resolve(root, target))
      .filter(mod => (mod.files.doc ?? []).some(file => /DOC[.]tsx?$/.test(file.sourceFile))));

    if (mods.size > 1) {
      // Build out docs
      await RepoExecUtil.execOnModules('workspace',
        mod => {
          const subProcess = spawn('trv', ['doc'], {
            timeout: 20000,
            cwd: mod.sourceFolder,
            env: {
              ...process.env,
              ...Env.TRV_MODULE.export(mod.name),
              ...Env.TRV_MANIFEST.export(undefined),
              ...Env.TRV_BUILD.export('none')
            }
          });

          ExecUtil.getResult(subProcess).catch(() => console.error(`${mod.name} - failed`));

          return subProcess;
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
          .replaceAll('process.env.NODE_ENV', text => text.replaceAll('.', '\u2024'));

        if (modName === 'todo-app') {
          html = html
            .replace(
              /(<h1>(?:[\n\r]|.)*)(<h2.*?\s*<ol>(?:[\r\n]|.)*?<\/ol>)((?:[\r\n]|.)*)/m,
              (_, heading, toc, text) =>
                `<div class="toc"><div class="inner">${toc.trim()}</div></div>\n<div class="documentation">\n${heading}\n${text}\n</div>\n`
            );
        }

        await fs.writeFile(page(`app/documentation/gen/${modName}/${modName}.component.html`), html, 'utf8');
      } catch (error) {
        if (error instanceof Error) {
          console.error(`${mod.name}: ${error.message}`);
        }
      }
    }
  }
}