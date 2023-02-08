import os from 'os';
import fs from 'fs/promises';
import path from 'path';
import cp from 'child_process';

import { ManifestUtil, ManifestRoot, ManifestContext } from '@travetto/manifest';

import { log, compileIfStale, getModuleSources } from '../../bin/transpile';
import { CompilerDeltaUtil, DeltaEvent } from './delta';


export async function createAndWriteManifest(ctx: ManifestContext, output: string, env: string = 'dev'): Promise<string> {
  const manifest = await ManifestUtil.buildManifest(ctx);

  // If in prod mode, only include std modules
  if (/^prod/i.test(env)) {
    manifest.modules = Object.fromEntries(
      Object.values(manifest.modules)
        .filter(x => x.profiles.includes('std'))
        .map(m => [m.name, m])
    );
  }
  if (!output.endsWith('.json')) {
    output = path.resolve(output, 'manifest.json');
  }

  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(manifest));
  return output;
}

/**
 *  Step 1
 */
async function buildManifest(ctx: ManifestContext): Promise<ManifestRoot> {
  log('[1] Manifest Generation');
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
      const files = await getModuleSources(ctx, mod.name, ['package.json', ...trans.map(x => x[0])]);
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

  if (out.length) {
    await fs.rm(path.resolve(ctx.workspacePath, ctx.outputFolder), { recursive: true, force: true });
    log('[2] Clearing output due to transformer source changes');
  }

  return out;
}

/**
 * Step 3
 */
async function getDelta(ctx: ManifestContext, manifest: ManifestRoot): Promise<DeltaEvent[]> {
  const outputExists = await fs.stat(path.resolve(ctx.workspacePath, ctx.outputFolder)).catch(() => { });
  if (!outputExists) {
    log('[3] Skipping delta, everything changed');
    return [{ type: 'changed', file: '*', module: ctx.mainModule } as const];
  } else {
    log('[3] Producing delta');
    const res = await CompilerDeltaUtil.produceDelta(ctx, manifest);
    log('[3] Produced delta', `changes=${res.length}`);
    return res;
  }
}

/**
 *  Step 4
 */
async function finalizeCompiler(ctx: ManifestContext, manifest: ManifestRoot, sourceChanged: boolean): Promise<void> {
  // Write manifest
  await ManifestUtil.writeManifest(ctx, manifest);
  log('[4] Wrote manifest', ctx.mainModule);

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
    log('[4] Rewrote monorepo manifests', names.join(', '));
  }
}

/**
 *  Step 5
 */
async function compileOutput(ctx: ManifestContext, manifest: ManifestRoot, delta: DeltaEvent[], watch: boolean = false): Promise<void> {

  const changed = delta.filter(x => x.type === 'added' || x.type === 'changed');
  log('[5] Compiling', `watch=${watch}`, `changed=${changed.length}`);

  // Blocking call, compile only
  if (changed.length || watch) {
    const compiler = path.resolve(ctx.workspacePath, ctx.compilerFolder);
    const main = path.resolve(compiler, 'node_modules', '@travetto/compiler/support/compiler-entry.js');
    const deltaFile = path.resolve(os.tmpdir(), `manifest-delta.${Date.now()}.${Math.random()}.json`);

    const changedFiles = changed.map(ev =>
      ev.file === '*' ? '*' : path.resolve(manifest.modules[ev.module].source, ev.file)
    );

    await fs.writeFile(deltaFile, changedFiles.join('\n'), 'utf8');
    const args = [main, deltaFile, `${watch}`];
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
    log('[5] Compiled', path.resolve(ctx.workspacePath, ctx.mainOutputFolder));
  } else {
    log('[5] Skipped compilation');
  }
}

export async function compile(ctx: ManifestContext, watch?: boolean): Promise<ManifestRoot> {
  const manifest = await buildManifest(ctx); // Step 1
  await precompileTransformers(ctx, manifest); // Step 2
  const delta = await getDelta(ctx, manifest); // Step 3
  await finalizeCompiler(ctx, manifest, delta.length > 0); // Step 4
  await compileOutput(ctx, manifest, delta, watch); // Step 5
  return manifest;
}