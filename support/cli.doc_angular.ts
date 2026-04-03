import fs from 'node:fs/promises';
import path from 'node:path';

import { Env, ExecUtil, Runtime } from '@travetto/runtime';
import { CliCommand, CliModuleUtil } from '@travetto/cli';
import { RepoExecUtil } from '@travetto/repo';
import type { IndexedModule } from '@travetto/manifest';

const page = (file: string): string => path.resolve('related/travetto.github.io/src', file);

/**
 * Generate documentation into the angular webapp under related/travetto.github.io
 */
@CliCommand()
export class DocAngularCommand {

  static async prepareAngularHtml(module: IndexedModule): Promise<void> {
    const moduleName = module.name.endsWith('mono-repo') ? 'overview' : module.name.split('/')[1];
    try {
      let html = await fs.readFile(path.resolve(module.sourcePath, 'DOC.html'), 'utf8');

      html = html
        .replace(/href="[^"]+travetto\/tree\/[^/]+\/module\/([^/"]+)"/g, (_, ref) => `routerLink="/docs/${ref}"`)
        .replace(/^src="images\//g, `src="/assets/images/${moduleName}/`)
        .replace(/(href|src)="https?:\/\/travetto.dev\//g, (_, attr) => `${attr}="/`)
        .replaceAll('@', '&#64;')
        .replaceAll('process.env.NODE_ENV', text => text.replaceAll('.', '\u2024'));

      if (moduleName === 'todo-app') {
        html = html
          .replace(
            /(<h1>(?:[\n\r]|.)*)(<h2.*?\s*<ol>(?:[\r\n]|.)*?<\/ol>)((?:[\r\n]|.)*)/m,
            (_, heading, toc, text) =>
              `<div class="toc"><div class="inner">${toc.trim()}</div></div>\n<div class="documentation">\n${heading}\n${text}\n</div>\n`
          );
      }

      await fs.writeFile(page(`app/documentation/gen/${moduleName}/${moduleName}.component.html`), html, 'utf8');
    } catch (error) {
      if (error instanceof Error) {
        console.error(`${module.name}: ${error.message}`);
      }
    }
  }

  preMain(): void {
    Env.DEBUG.set(false);
  }

  async main(target?: string): Promise<void> {
    const root = Runtime.workspace.path;

    if (target && target.startsWith(root)) {
      target = target.replace(root, '').split('/').at(-1);
    }

    const modules = new Set((await CliModuleUtil.findModules('workspace'))
      .filter(module => !target || module.sourcePath === path.resolve(root, target))
      .filter(module => (module.files.doc ?? []).some(file => /DOC[.]tsx?$/.test(file.sourceFile))));

    if (modules.size > 1) {
      // Build out docs
      await RepoExecUtil.execOnModules('workspace',
        module => {
          const subProcess = ExecUtil.spawnPackageCommand('trv', ['doc'], {
            timeout: 20000,
            cwd: module.sourceFolder,
            env: {
              ...process.env,
              ...Env.TRV_MODULE.export(module.name),
              ...Env.TRV_MANIFEST.export(undefined),
              ...Env.TRV_BUILD.export('none')
            }
          });

          ExecUtil.getResult(subProcess)
            .then(() => DocAngularCommand.prepareAngularHtml(module))
            .catch(() => console.error(`${module.name} - failed`));

          return subProcess;
        },
        {
          showStdout: false,
          progressMessage: module => `Running 'trv doc' [%idx/%total] ${module?.sourceFolder ?? ''}`,
          includeMonorepoRoot: true,
          filter: module => modules.has(module),
          showProgressList: true
        });
    } else {
      const module = [...modules][0];
      await ExecUtil.getResult(ExecUtil.spawnPackageCommand('trv', ['doc'], {
        env: { ...process.env, ...Env.TRV_MANIFEST.export(''), ...Env.TRV_BUILD.export('none') },
        cwd: module.sourcePath,
        stdio: 'inherit'
      }));
      await DocAngularCommand.prepareAngularHtml(module);
    }
  }
}