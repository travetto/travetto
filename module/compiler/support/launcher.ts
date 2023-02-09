import fs from 'fs/promises';
import path from 'path';

import type { ManifestContext } from '@travetto/manifest';
import { TranspileUtil } from './transpile';

const SOURCE_SEED = ['package.json', 'index.ts', '__index__.ts', 'src', 'support', 'bin'];
const IS_DEBUG = /\b([*]|build)\b/.test(process.env.DEBUG ?? '');
const PRECOMPILE_MODS = ['@travetto/terminal', '@travetto/manifest', '@travetto/transformer', '@travetto/compiler'];
const SCOPES = ['precompile', 'transformers', 'compile', 'initialize', 'delta', 'manifest', 'finalize'] as const;
const SCOPE_MAX = SCOPES.reduce((a, v) => Math.max(a, v.length), 0);

type ScopeType = (typeof SCOPES)[number];

const importManifest = (ctx: ManifestContext): Promise<typeof import('@travetto/manifest')> =>
  import(path.resolve(ctx.workspacePath, ctx.compilerFolder, 'node_modules', '@travetto/manifest/__index__.js'));

const runAction = async <T>(scope: ScopeType, op: () => AsyncGenerator<string, T>, ...args: string[]): Promise<T> => {
  const itr = op();
  let val: IteratorResult<string, T> | undefined;
  while (val === undefined || val.done === false) {
    val = await itr.next();
    if (val.done) {
      break;
    } else {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      IS_DEBUG && console.debug(new Date().toISOString(), `[${scope.padEnd(SCOPE_MAX, ' ')}]`, ...args, (val.value as string).replaceAll(process.cwd(), '.'));
    }
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return val.value as T;
};

/**
 * Recompile folder if stale
 */
async function compileIfStale(ctx: ManifestContext, scope: ScopeType, mod: string, seed: string[]): Promise<string[]> {
  const files = await TranspileUtil.getModuleSources(ctx, mod, seed);
  const changes = files.filter(x => x.stale).map(x => x.input);
  const out: string[] = [];

  try {
    await runAction(scope, async function* () {
      if (files.some(f => f.stale)) {
        yield 'Starting';
        for (const file of files.filter(x => x.stale)) {
          await TranspileUtil.transpileFile(ctx, file.input, file.output);
        }
        if (changes.length) {
          out.push(...changes.map(x => `${mod}/${x}`));
          yield `Source changed: ${changes.join(', ')}`;
        }
        yield 'Completed';
      } else {
        yield 'Skipped';
      }
    }, mod);
  } catch (err) {
    console.error(err);
  }


  return out;
}

/**
 * Run the compiler
 */
export async function compile(ctx: ManifestContext, watch = false): Promise<void> {
  let changes = 0;

  await runAction('precompile', async function* () {
    yield 'Starting';
    for (const mod of PRECOMPILE_MODS) {
      changes += (await compileIfStale(ctx, 'precompile', mod, SOURCE_SEED)).length;
    }
    yield 'Completed';
  });

  const { ManifestUtil, ManifestDeltaUtil } = await importManifest(ctx);

  const manifest = await runAction('manifest', async function* () {
    yield 'Generating';
    const res = await ManifestUtil.buildManifest(ctx);
    yield 'Generated';
    return res;
  });

  await runAction('transformers', async function* () {
    yield 'Starting';
    for (const mod of Object.values(manifest.modules).filter(m => m.files.$transformer?.length)) {
      changes += (await compileIfStale(ctx, 'transformers', mod.name, ['package.json', ...mod.files.$transformer!.map(x => x[0])])).length;
    }
    yield 'Completed';
  });

  const delta = await runAction('delta', async function* () {
    yield 'Generating';
    if (changes) {
      yield 'Skipping, everything changed';
      return [{ type: 'changed', file: '*', module: ctx.mainModule } as const];
    } else {
      const res = await ManifestDeltaUtil.produceDelta(ctx, manifest);
      yield 'Generated';
      return res;
    }
  });

  await runAction('finalize', async function* () {
    if (changes) {
      await fs.rm(path.resolve(ctx.workspacePath, ctx.outputFolder), { recursive: true, force: true });
      yield 'Clearing output due to compiler changes';
    }

    // Write manifest
    await ManifestUtil.writeManifest(ctx, manifest);
    yield `Wrote manifest ${ctx.mainModule}`;

    // Update all manifests
    if (delta.length && ctx.monoRepo && !ctx.mainFolder) {
      const names: string[] = [];
      const mods = Object.values(manifest.modules).filter(x => x.local && x.name !== ctx.mainModule);
      for (const mod of mods) {
        await ManifestUtil.rewriteManifest(path.resolve(ctx.workspacePath, mod.sourceFolder));
        names.push(mod.name);
      }
      yield `Rewrote monorepo manifests ${names.join(', ')}`;
    }
  });

  await runAction('compile', async function* () {
    const changed = delta.filter(x => x.type === 'added' || x.type === 'changed');
    yield `Started watch=${watch} changed=${changed.map(x => `${x.module}/${x.file}`)}`;
    if (changed.length || watch) {
      await TranspileUtil.runCompiler(ctx, manifest, changed, watch);
      yield 'Finished';
    } else {
      yield 'Skipped';
    }
  });
}

/**
 * Clean output
 */
export async function clean(ctx: ManifestContext): Promise<void> {
  await fs.rm(path.resolve(ctx.workspacePath, ctx.outputFolder), { force: true, recursive: true });
  await fs.rm(path.resolve(ctx.workspacePath, ctx.compilerFolder), { force: true, recursive: true });
}

/**
 * Export manifests
 */
export async function exportManifest(ctx: ManifestContext, output?: string, env = 'dev'): Promise<string | undefined> {
  const { ManifestUtil } = await importManifest(ctx);
  const manifest = await ManifestUtil.buildManifest(ctx);

  // If in prod mode, only include std modules
  if (/^prod/i.test(env)) {
    manifest.modules = Object.fromEntries(
      Object.values(manifest.modules)
        .filter(x => x.profiles.includes('std'))
        .map(m => [m.name, m])
    );
    // Mark output folder/workspace path as portable
    manifest.outputFolder = '';
    manifest.workspacePath = '';
  }
  if (output) {
    if (!output.endsWith('.json')) {
      output = path.resolve(output, 'manifest.json');
    }

    await TranspileUtil.writeTextFile(output, JSON.stringify(manifest));
    return output;
  } else {
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }
}