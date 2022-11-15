import type { Manifest } from '@travetto/common';

import { Compiler } from '../src/compiler';

/**
 * The compilation process to establish the working folder for all the source, with support for transformers.  This pass outputs:
 *  - @travetto/Transformer
 *  - @travetto/Compiler
 *  - @travetto/Common
 *  - **\/support/transformer.*
 */
export class SetupCompiler extends Compiler {

  init(state: Manifest.State, output: string): typeof this {
    const outManifest: Manifest.Root = {
      ...state.manifest,
      modules: {},
      main: '__tbd___'
    };
    const outDelta: Manifest.Delta = {};
    const trans = state.manifest.modules['@travetto/transformer'];
    const compiler = state.manifest.modules['@travetto/compiler'];
    const common = state.manifest.modules['@travetto/common'];

    outManifest.modules['@travetto/transformer'] = { ...trans };
    outManifest.modules['@travetto/compiler'] = { ...compiler };
    outManifest.modules['@travetto/common'] = { ...common };

    for (const [name, { files, ...mod }] of Object.entries(state.manifest.modules)) {
      const transformers = files.support?.filter(([x]) => x.startsWith('support/transform')) ?? [];
      if (transformers.length) {
        outManifest.modules[name] ??= { ...mod, files: outManifest.modules[name]?.files ?? {} };
        (outManifest.modules[name].files.support ??= []).push(...transformers);
      }
    }

    for (const [name, mod] of Object.entries(outManifest.modules)) {
      const allFiles = new Set<string>();
      for (const files of Object.values(mod.files)) {
        for (const [file] of files ?? []) {
          allFiles.add(file);
        }
      }
      const changed = state.delta[name].filter(([file]) => allFiles.has(file));
      if (changed.length) {
        outDelta[name] = changed;
      }
    }

    outManifest.buildLocation = state.manifest.buildLocation;

    return super.init({ manifest: outManifest, delta: outDelta }, output);
  }
}

if (require.main === module) {
  SetupCompiler.main();
}