import * as ts from 'typescript';
import { TransformerManager } from '@travetto/transformer';

import { Compiler } from './compiler';
import { ManifestState } from './types';

export class OutputCompiler extends Compiler {

  #transformerManager: TransformerManager;
  #transformers: string[];

  init(state: ManifestState, outputFolder: string): typeof this {
    super.init(state, outputFolder);

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
`)
  }
}

if (require.main === module) {
  OutputCompiler.main();
}