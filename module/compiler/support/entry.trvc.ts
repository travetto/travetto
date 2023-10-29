import type { ManifestContext } from '@travetto/manifest';

import { LogUtil } from './log';
import { CompilerSetup } from './setup';
import { CompilerServer } from './server/server';
import { CompilerRunner } from './server/runner';
import type { BuildOp, EntryOp } from './types';
import { CompilerClientUtil } from './server/client';
import { CommonUtil } from './util';

async function build(root: ManifestContext, op: BuildOp): Promise<void> {
  const server = await new CompilerServer(root, op).listen();

  // Wait for build to be ready
  if (server) {
    await server.processEvents(async function* (signal) {
      const { changed, manifest } = await CompilerSetup.setup(root);
      yield* CompilerRunner.runProcess(root, manifest, changed, op === 'watch', signal);
    });
  } else {
    await CompilerClientUtil.waitForBuild(root);
  }
}

/**
 * Main entry point for trv.js
 */
export async function main(ctx: ManifestContext, root: ManifestContext, op: EntryOp, args: (string | undefined)[] = []): Promise<((mod: string) => Promise<unknown>) | undefined> {
  LogUtil.initLogs(ctx, op);
  switch (op) {
    case 'manifest': await CompilerSetup.exportManifest(ctx, ...args.filter(x => !x?.startsWith('-'))); return;
    case 'watch':
    case 'build': await build(root, op); return;
    case 'run': {
      await build(root, 'build');
      return CommonUtil.moduleLoader(ctx);
    }
  }
}