import os from 'os';
import fs from 'fs/promises';
import path from 'path';
import cp from 'child_process';

import type { ManifestRoot, ManifestContext } from '@travetto/manifest';

import { log, compileIfStale, getProjectSources, addNodePath, importManifestUtil } from './utils';
import { CompilerDeltaUtil, DeltaEvent } from './delta';

const PRECOMPILE_MODS = [
  '@travetto/terminal',
  '@travetto/manifest',
  '@travetto/transformer',
  '@travetto/compiler'
] as const;

/**
 * Step 0
 */
export async function precompile(ctx: ManifestContext): Promise<string[]> {
  const out: string[] = [];
  for (const mod of PRECOMPILE_MODS) {
    const files = await getProjectSources(ctx, mod);
    const changes = files.filter(x => x.stale).map(x => x.input);
    await compileIfStale(ctx, `[0] Compiling ${mod}`, files);
    if (changes.length) {
      out.push(...changes.map(x => `${mod}/${x}`));
      log(`[0] Compiler source changed ${mod}`, changes);
    }
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return out;
}

export async function createAndWriteManifest(ctx: ManifestContext, output: string, env: string = 'dev'): Promise<void> {
  const { ManifestUtil } = await importManifestUtil(ctx);
  const manifest = await ManifestUtil.buildManifest(ctx);

  // If in prod mode, only include std modules
  if (/^prod/i.test(env)) {
    manifest.modules = Object.fromEntries(
      Object.values(manifest.modules)
        .filter(x => x.profiles.includes('std'))
        .map(m => [m.name, m])
    );
  }
  await fs.writeFile(output, JSON.stringify(manifest));
}

/**
 *  Step 1
 */
async function buildManifest(ctx: ManifestContext): Promise<ManifestRoot> {
  log('[1] Manifest Generation');
  const { ManifestUtil } = await importManifestUtil(ctx);
  return ManifestUtil.buildManifest(ctx);
}

/**
 * Step 2
 */
async function precompileTransformers(ctx: ManifestContext, manifest: ManifestRoot): Promise<string[]> {
  const out: string[] = [];

  for (const mod of Object.values(manifest.modules)) {
    const trans = mod.files.$transformer ?? [];
    if (trans.length) {
      const files = await getProjectSources(ctx, mod.name, ['package.json', ...trans.map(x => x[0])]);
      await compileIfStale(
        ctx,
        `[2] Transformer Compiling ${mod.name}`,
        files
      );
      const changes = files.filter(x => x.stale).map(x => x.input);
      if (changes.length) {
        log(`[2] Transformer source changed ${mod.name}`, changes);
        out.push(...changes.map(x => `${mod.name}/${x}`));
      }
    }
  }

  return out;
}

/**
 *  Step 2
 */
async function finalizeCompiler(ctx: ManifestContext, manifest: ManifestRoot, sourceChanged: boolean, compilerChanged: boolean): Promise<void> {
  const { ManifestUtil } = await importManifestUtil(ctx);

  // Clean output if compiler changed
  if (compilerChanged) {
    log('[3] Clearing output due to compiler changes');
    await fs.rm(path.resolve(ctx.workspacePath, ctx.outputFolder), { recursive: true, force: true });
  }

  // Write manifest
  await ManifestUtil.writeManifest(ctx, manifest);
  log('[3] Wrote manifest', ctx.mainModule);

  // Update all manifests
  if (sourceChanged && ctx.monoRepo && ctx.workspacePath === ctx.mainPath) {
    const names: string[] = [];
    for (const mod of Object.keys(manifest.modules)) {
      if (mod !== ctx.mainModule && manifest.modules[mod].local) {
        const subCtx = await ManifestUtil.buildContext(manifest.modules[mod].source);
        const subManifest = await ManifestUtil.buildManifest(subCtx);
        await ManifestUtil.writeManifest(subCtx, subManifest);
        names.push(mod);
      }
    }
    log('[3] Rewrote monorepo manifests', names.join(', '));
  }
}

/**
 *  Step 4
 */
async function compileOutput(ctx: ManifestContext, manifest: ManifestRoot, delta: DeltaEvent[], watch?: boolean): Promise<void> {

  log('[4] Compiling');
  const changed = delta.filter(x => x.type === 'added' || x.type === 'changed');

  // Blocking call, compile only
  if (changed.length || watch) {
    const compiler = path.resolve(ctx.workspacePath, ctx.compilerFolder);
    const main = path.resolve(compiler, 'node_modules', '@travetto/compiler/support/compile');
    const deltaFile = path.resolve(os.tmpdir(), `manifest-delta.${Date.now()}.${Math.random()}.json`);

    const changedFiles = changed.map(ev =>
      ev.file === '*' ? '*' : path.resolve(manifest.modules[ev.module].source, ev.file)
    );

    await fs.writeFile(deltaFile, changedFiles.join('\n'), 'utf8');
    const args = [main, deltaFile, ...(watch ? ['true'] : [])];
    const res = cp.spawnSync(process.argv0, args, {
      env: {
        ...process.env,
        TRV_MANIFEST: path.resolve(ctx.workspacePath, ctx.mainOutputFolder),
        TRV_THROW_ROOT_INDEX_ERR: '1',
        NODE_PATH: [compiler, process.env.NODE_PATH ?? ''].join(path.delimiter)
      },
      stdio: 'inherit',
      encoding: 'utf8'
    });
    if (res.status) {
      throw new Error(res.stderr);
    }
    log('[4] Compiled', path.resolve(ctx.workspacePath, ctx.mainOutputFolder));
  } else {
    log('[4] Skipped compilation');
  }
}

export async function compile(ctx: ManifestContext, watch?: boolean): Promise<ManifestRoot> {
  const compilerChanges = await precompile(ctx); // Step 0
  const manifest = await buildManifest(ctx); // Step 1
  const transChanges = await precompileTransformers(ctx, manifest); // Step 2

  const totalChanges = compilerChanges.length + transChanges.length;
  const delta = totalChanges > 0 ?
    [{ type: 'changed', file: '*', module: ctx.mainModule } as const] :
    await CompilerDeltaUtil.produceDelta(ctx, manifest);

  await finalizeCompiler(ctx, manifest, delta.length > 0, totalChanges > 0); // Step 3
  await compileOutput(ctx, manifest, delta, watch); // Step 4

  await addNodePath(ctx);
  return manifest;
}