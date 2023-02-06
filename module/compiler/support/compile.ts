import { install } from 'source-map-support';

import { ManifestIndex, path } from '@travetto/manifest';

import { ManifestDeltaUtil } from './bin/delta';

install();

const idx = new ManifestIndex(process.env.TRV_MANIFEST!);

ManifestDeltaUtil.produceDelta(
  path.resolve(idx.manifest.workspacePath, idx.manifest.outputFolder),
  idx.manifest
).then(async delta => {
  const totalChanged = Object.values(delta).reduce((acc, l) => acc + l.length, 0);
  const watch = process.argv[2] === 'true';

  if (watch || totalChanged) {
    const { Compiler } = await import('../src/compiler.js');
    return new Compiler(idx.manifest, delta).run(watch);
  }
});