import type { ManifestContext } from '@travetto/manifest';

import { LogUtil } from './log';
import { CompilerSetup } from './setup';
import { CompilerServer } from './server/server';
import { CompilerRunner } from './server/runner';
import { CommonUtil } from './util';
import type { BuildOp, MainOp } from './types';
import { CompilerClientUtil } from './server/client';

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
export async function main(ctx: ManifestContext, root: ManifestContext, op: MainOp, args: (string | undefined)[] = []): Promise<void> {
  LogUtil.initLogs(ctx, op);
  switch (op) {
    case 'manifest': return CompilerSetup.exportManifest(ctx, ...args);
    case 'watch':
    case 'build': return build(root, op);
    case 'run': {
      await build(root, 'build');
      return CommonUtil.runCli(ctx);
    }
  }
}