import * as ts from 'typescript';
import { TransformerManager } from '@travetto/transformer';

import { Compiler, main } from './compiler-simple';
import { Manifest } from './types';

export class OutputCompiler extends Compiler {

  #transformerManager: TransformerManager;
  #transformers: string[];
  #bootLocation: string;

  constructor(manifest: Manifest, outputFolder: string) {
    super(manifest, outputFolder);
    this.#bootLocation = manifest.buildLocation;
    this.#transformers = this.modules.flatMap(
      x => (x.files.support ?? [])
        .filter(([f, type]) => type === 'ts' && f.startsWith('support/transformer.'))
        .map(([f]) =>
          (`${this.#bootLocation}/${x.output}/${f}`.replace(/[.][tj]s$/, ''))
        )
    );
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

      // Symlink resources
      await this.workspace.symlinkFolder(module, 'resources');
      await this.workspace.symlinkFolder(module, 'support/fixtures');
    }

    const main = this.modules.find(x => x.root);
    if (main) {
      await this.workspace.symlinkFolder(main, 'test/fixtures');
    }

    // Write manifest
    await this.workspace.writeRawFile('manifest.json', JSON.stringify(this.manifest, null, 2));
  }
}

if (require.main === module) {
  main(OutputCompiler, process.argv.at(-2)!, process.argv.at(-1)!);
}