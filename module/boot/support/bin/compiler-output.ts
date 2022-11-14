import * as ts from 'typescript';
import * as fs from 'fs/promises';

import { TransformerManager } from '@travetto/transformer';
import { path, Manifest } from '@travetto/common';

import { Compiler } from './compiler';

export class OutputCompiler extends Compiler {

  #transformerManager: TransformerManager;
  #transformers: string[];
  #outputFolder: string;

  init(state: Manifest.State, outputFolder: string): typeof this {
    super.init(state, outputFolder);

    this.#outputFolder = outputFolder;

    this.#transformers = this.modules.flatMap(
      x => (x.files.support ?? [])
        .filter(([f, type]) => type === 'ts' && f.startsWith('support/transformer.'))
        .map(([f]) =>
          (`${state.manifest.buildLocation}/${x.output}/${f}`.replace(/[.][tj]s$/, ''))
        )
    );
    return this;
  }

  async prepareTransformer(program: ts.Program): Promise<void> {
    this.#transformerManager = new TransformerManager();
    await this.#transformerManager.init(this.#transformers, this.modules);
    this.#transformerManager.build(program.getTypeChecker());
  }

  getTransformer(): ts.CustomTransformers {
    return this.#transformerManager.getTransformers()!;
  }

  async outputInit(): Promise<void> {
    for (const module of this.modules) {
      // Copy over all js files
      for (const [folder, files] of Object.entries(module.files)) {
        if (folder === 'bin' || folder === 'support') {
          for (const [jsFile, ext] of files!) {
            if (ext === 'js') {
              await this.workspace.copyFile(module, jsFile);
            }
          }
        }
      }
    }
    // Write manifest
    await this.workspace.writeRawFile('manifest.json', JSON.stringify(this.manifest));
    await this.workspace.writeRawFile('.env.js', `
process.env.TRV_OUTPUT=process.cwd();
process.env.TRV_COMPILED=1;
`);
  }

  async watch(): Promise<void> {
    const files = this.getDirtyFiles();
    const { FilePresenceManager } = await import('@travetto/watch');

    const folders = this.modules.filter(x => x.local).map(x => x.source).sort((a, b) => b.length - a.length);

    new FilePresenceManager(
      folders,
      {
        ignoreInitial: true,
        validFile: x => x.endsWith('.ts') && !x.endsWith('.d.ts')
      }
    ).on('all', async ({ event, entry }) => {
      const modRoot = folders.find(f => entry.file.startsWith(f));
      const mod = this.modules.find(m => m.source === modRoot)!;
      const source = entry.file.replaceAll('\\', '/');
      const relativeOutput = source.replace(mod.source, mod.output);
      const output = path.resolve(this.#outputFolder, relativeOutput);

      switch (event) {
        case 'removed': {
          if (output) {
            await fs.unlink(output).catch(() => { });
          }
          break;
        }
        case 'added': {
          files.push(relativeOutput);
          const prog = await this.getProgram(files, true);
          this.emitFile(prog, relativeOutput);
          break;
        }
        case 'changed': {
          const prog = await this.getProgram(files, true);
          this.emitFile(prog, relativeOutput);
          break;
        }
      }
    });

    await new Promise(r => setTimeout(r, 1000 * 60 * 60 * 24));
  }

  async run(): Promise<void> {
    await super.run();
    if (process.env.TRV_WATCH === '1') {
      await this.watch();
    }
  }
}

if (require.main === module) {
  OutputCompiler.main();
}