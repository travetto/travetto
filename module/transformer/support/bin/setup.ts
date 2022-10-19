#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';

import { buildManifestModules, ModuleShape } from './manifest';
import {
  CWD, COMPILER_OUTPUT, SOURCE_OUTPUT, TS_TARGET, TSC, STAGING_OUTPUT
} from './config';

type CompileContext = {
  modules: ModuleShape[];
  transforming: ModuleShape[];
  transformer: ModuleShape;
};

function writeManifest(modules: ModuleShape[]): void {
  fs.mkdirSync(COMPILER_OUTPUT, { recursive: true });
  fs.writeFileSync(`${COMPILER_OUTPUT}/manifest.json`, JSON.stringify(modules));
}

export function init(): void {
  if (!fs.existsSync(COMPILER_OUTPUT)) {
    cp.spawnSync(process.argv0, [__filename], { stdio: ['pipe', 'pipe', 2], env: process.env });
  }

  writeManifest(buildManifestModules());

  // Compile
  cp.spawnSync(process.argv0, [
    `${COMPILER_OUTPUT}/node_modules/@travetto/transformer/support/main.compiler`,
    SOURCE_OUTPUT,
  ], { stdio: ['pipe', 'pipe', 2], env: process.env });


  if (!process.env.TRV_CACHE) {
    if (fs.existsSync(SOURCE_OUTPUT)) {
      process.env.TRV_CACHE = SOURCE_OUTPUT;
    } else if (fs.existsSync(COMPILER_OUTPUT)) {
      process.env.TRV_CACHE = COMPILER_OUTPUT;
    }
  }
}

function getModuleContext(): CompileContext {
  const modules = buildManifestModules();

  const transforming = modules
    .filter(x => x.files.support?.find(([name, type]) => type === 'ts' && name.startsWith('support/transform')));

  const transformer = modules.find(x => x.name === '@travetto/transformer')!;

  return {
    modules,
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

  writeManifest(context.modules);
}

if (require.main === module) {
  precompile(getModuleContext());
}
