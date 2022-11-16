import * as fs from 'fs/promises';

import { ManifestState, path } from '@travetto/manifest';

import { Compiler, TransformerProvider } from '../src/compiler';

export class OutputCompiler extends Compiler {

  #transformers: string[];

  init(state: ManifestState, outputFolder: string): typeof this {
    super.init(state, outputFolder);

    this.#transformers = this.state.modules.flatMap(
      x => (x.files.support ?? [])
        .filter(([f, type]) => type === 'ts' && f.startsWith('support/transformer.'))
        .map(([f]) =>
          (`${state.manifest.buildLocation}/${x.output}/${f}`.replace(/[.][tj]s$/, ''))
        )
    );
    return this;
  }

  async createTransformerProvider(): Promise<TransformerProvider> {
    const { TransformerManager } = await import('@travetto/transformer');
    return TransformerManager.create(this.#transformers, this.state.modules);
  }

  async writeRawFile(file: string, contents: string): Promise<void> {
    const outFile = path.resolve(this.state.outputFolder, file);
    console.debug('Writing', outFile);
    await fs.mkdir(path.dirname(outFile), { recursive: true });
    await fs.writeFile(outFile, contents, 'utf8');
  }

  async outputInit(): Promise<void> {
    // Write manifest
    await this.writeRawFile('manifest.json', JSON.stringify(this.state.manifest));
    await this.writeRawFile('.env.js', `
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