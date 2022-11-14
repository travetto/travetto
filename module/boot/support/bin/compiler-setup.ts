import { Compiler } from './compiler';
import { ManifestUtil } from './manifest';
import { Manifest, ManifestDelta, ManifestState } from './types';

export class SetupCompiler extends Compiler {

  init(state: ManifestState, output: string): typeof this {
    const outManifest: Manifest = ManifestUtil.wrapModules({});
    const outDelta: ManifestDelta = {};
    const trans = state.manifest.modules['@travetto/transformer'];
    const boot = state.manifest.modules['@travetto/boot'];

    outManifest.modules['@travetto/transformer'] = {
      ...trans,
      files: {
        index: trans.files.index,
        src: trans.files.src,
        support: trans.files.support.filter(([x]) => !x.startsWith('support/test')),
      }
    };

    outManifest.modules['@travetto/boot'] = {
      ...boot,
      files: {
        bin: boot.files.bin,
        support: boot.files.support.filter(([x]) => x.startsWith('support/bin/')),
      }
    };

    for (const [name, { files, ...mod }] of Object.entries(state.manifest.modules)) {
      const transformers = files.support?.filter(([x]) => x.startsWith('support/transform')) ?? [];
      if (transformers.length) {
        outManifest.modules[name] ??= { ...mod, files: outManifest.modules[name]?.files ?? {} };
        (outManifest.modules[name].files.support ??= []).push(...transformers)
      }
    }

    for (const [name, mod] of Object.entries(outManifest.modules)) {
      const allFiles = new Set<string>();
      for (const [folder, files] of Object.entries(mod.files)) {
        for (const [file] of files) {
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