import { Compiler, main } from './compiler-simple';
import { Manifest, ManifestDelta, ManifestState } from './types';

function restrictManifest(state: ManifestState): ManifestState {
  const outManifest: Manifest = { generated: Date.now(), modules: {} };
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
    const changed = state.delta[name].filter(([file]) => allFiles.has(file));;
    if (changed.length) {
      outDelta[name] = changed;
    }
  }

  return { manifest: outManifest, delta: outDelta }
}

if (require.main === module) {
  main(Compiler, process.argv.at(-2)!, process.argv.at(-1)!, restrictManifest);
}