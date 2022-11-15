import { TransformerManager } from '@travetto/transformer';
import { Manifest } from '@travetto/common';

import { Compiler, TransformerProvider } from './compiler';

export class OutputCompiler extends Compiler {

  #transformers: string[];

  init(state: Manifest.State, outputFolder: string): typeof this {
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

  async createTransformerProvider(): Promise<TransformerProvider> {
    return TransformerManager.create(this.#transformers, this.modules);
  }

  async outputInit(): Promise<void> {
    // Write manifest
    await this.workspace.writeRawFile('manifest.json', JSON.stringify(this.manifest));
    await this.workspace.writeRawFile('.env.js', `
process.env.TRV_OUTPUT=process.cwd();
process.env.TRV_COMPILED=1;
`);
  }

  isWatching(): boolean {
    return process.env.TRV_WATCH === 'true';
  }
}

if (require.main === module) {
  OutputCompiler.main();
}