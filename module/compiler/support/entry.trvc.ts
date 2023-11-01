import type { ManifestContext } from '@travetto/manifest';

import { LogUtil } from './log';
import { CompilerSetup } from './setup';
import { CompilerServer } from './server/server';
import { CompilerRunner } from './server/runner';
import type { CompilerOp } from './types';
import { CompilerClientUtil } from './server/client';
import { CommonUtil } from './util';

/** Main entry point for compilation */
export async function main(ctx: ManifestContext, root: ManifestContext, op: CompilerOp): Promise<(mod: string) => Promise<unknown>> {
  LogUtil.initLogs(ctx, op === 'run' ? 'error' : 'info');

  const server = await new CompilerServer(root, op).listen();

  // Wait for build to be ready
  if (server) {
    await server.processEvents(async function* (signal) {
      const { changed, manifest } = await CompilerSetup.setup(root);
      yield* CompilerRunner.runProcess(root, manifest, changed, op, signal);
    });
  } else {
    await CompilerClientUtil.waitForBuild(root);
  }
  return CommonUtil.moduleLoader(ctx);
}

/** Manifest entry point */
export async function manifest(ctx: ManifestContext, args: (string | undefined)[] = []): Promise<void> {
  await CompilerSetup.exportManifest(ctx, ...args.filter(x => !x?.startsWith('-'))); return;
}