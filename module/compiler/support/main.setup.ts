import type { ManifestState, ManifestRoot, ManifestDelta } from '@travetto/manifest';

import { Compiler } from '../src/compiler';

/**
 * The compilation process to establish the working folder for all the source, with support for transformers.  This pass outputs:
 *  - @travetto/transformer
 *  - @travetto/compiler
 *  - @travetto/manifest
 *  - **\/support/transformer.*
 */
export class SetupCompiler extends Compiler {

  init(state: ManifestState, output: string): typeof this {
    const outManifest: ManifestRoot = {
      ...state.manifest,
      modules: {},
      main: '__tbd___'
    };
    const outDelta: ManifestDelta = {};
    const trans = state.manifest.modules['@travetto/transformer'];
    const compiler = state.manifest.modules['@travetto/compiler'];
    const manifest = state.manifest.modules['@travetto/manifest'];

    outManifest.modules['@travetto/transformer'] = { ...trans };
    outManifest.modules['@travetto/compiler'] = { ...compiler };
    outManifest.modules['@travetto/manifest'] = { ...manifest };

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