#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';

import { ModuleShape, ManifestShape, ManifestUtil } from '@travetto/manifest';

import { CWD, COMPILER_OUTPUT, TS_TARGET, TSC, STAGING_OUTPUT } from './config';

type CompileContext = {
  manifest: ManifestShape;
  transforming: ModuleShape[];
  transformer: ModuleShape;
};

function getModuleContext(): CompileContext {
  const manifest = ManifestUtil.buildManifest();

  const transforming = Object.values(manifest.modules)
    .filter(x => x.files.support?.find(([name, type]) => type === 'ts' && name.startsWith('support/transform')));

  const transformer = manifest.modules['@travetto/transformer'];

  return {
    manifest,
    transforming,
    transformer
  };
}

function buildTsconfig(context: CompileContext): Record<string, unknown> {
  const projTsconfig = path.resolve(CWD, 'tsconfig.json');
  const baseTsconfig = path.resolve(context.transformer.source, 'tsconfig.trv.json');
  // Fallback to base tsconfig if not found in local folder
  const config = fs.existsSync(projTsconfig) ? projTsconfig : baseTsconfig;

  const tsconfig = {
    extends: config,
    compilerOptions: {
      rootDir: path.resolve(STAGING_OUTPUT),
      outDir: COMPILER_OUTPUT,
      skipLibCheck: true,
      target: TS_TARGET,
    },
    files: [
      ...[
        ...context.transformer.files.src ?? [],
        ...context.transformer.files.support ?? [],
        ...context.transformer.files.index ?? []
      ]
        .map(y => `${STAGING_OUTPUT}/${context.transformer.output}/${y[0]}`),
      ...context.transforming.flatMap(x =>
        x.files.support?.
          filter(y => y[0].startsWith('support/transform'))
          .map(y => `${STAGING_OUTPUT}/${x.output}/${y[0]}`))
    ]
  };

  return tsconfig;
}

export function precompile(context: CompileContext = getModuleContext()): void {
  fs.rmSync(COMPILER_OUTPUT, { recursive: true, force: true });
  fs.rmSync(STAGING_OUTPUT, { recursive: true, force: true });
  fs.mkdirSync(STAGING_OUTPUT);


  // May only be needed in dev mode
  fs.mkdirSync(`${STAGING_OUTPUT}`, { recursive: true });
  fs.mkdirSync(`${STAGING_OUTPUT}/node_modules/@travetto`, { recursive: true });
  for (const el of [...context.transforming, context.transformer]) {
    if (el.output) {
      if (!fs.existsSync(`${STAGING_OUTPUT}/${el.output}`)) {
        fs.symlinkSync(el.source, `${STAGING_OUTPUT}/${el.output}`);
      }
    } else {
      for (const f of ['support']) {
        if (!fs.existsSync(`${STAGING_OUTPUT}/${f}`)) {
          fs.symlinkSync(`${el.source}/${f}`, `${STAGING_OUTPUT}/${f}`);
        }
      }
    }
  }
  fs.writeFileSync(`${STAGING_OUTPUT}/tsconfig.json`, JSON.stringify(buildTsconfig(context), null, 2));
  cp.spawnSync(TSC, { cwd: STAGING_OUTPUT, stdio: 'pipe' });
}

if (require.main === module) {
  precompile(getModuleContext());
}
