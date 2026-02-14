import fs from 'node:fs/promises';
import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import path from 'node:path';

import mustache from 'mustache';

import { castKey, castTo, CodecUtil, ExecUtil, JSONUtil, RuntimeIndex } from '@travetto/runtime';
import { cliTpl } from '@travetto/cli';
import { type NodePackageManager, PackageUtil } from '@travetto/manifest';
import { Terminal } from '@travetto/terminal';

import type { Feature } from './features.ts';

type ListingEntry = { requires?: string[], rename?: string };
type Listing = Record<string, ListingEntry>;

const DEV_DEPENDENCIES = new Set([
  '@travetto/test',
  '@travetto/pack',
  '@travetto/compiler',
  '@travetto/transformer',
  '@travetto/eslint',
]);

export class Context {

  static #meetsRequirement(modules: string[], desired: string[]): boolean {
    let valid = true;
    for (const module of desired) {
      valid = valid && modules.includes(module);
      if (!valid) {
        break;
      }
    }
    return valid;
  }

  #template: string;
  #targetDirectory: string;
  #dependencies: string[] = [];
  #devDependencies: string[] = [];
  #peerDependencies: string[] = [];
  #featureContexts: Record<string, unknown>[] = [];

  packageManager: NodePackageManager = 'npm';

  readonly name: string;

  constructor(name: string, template: string, targetDirectory: string) {
    this.name = name.replace(/[^a-zA-Z0-9]+/, '-').replace(/-+$/, '');
    this.#template = template;
    this.#targetDirectory = path.resolve(targetDirectory);
  }

  #exec(cmd: string, args: string[], options?: { spawn?: (cmd: string, args: string[], options?: SpawnOptions) => ChildProcess }): Promise<void> {
    const terminal = new Terminal();
    const spawnCmd = options?.spawn ?? spawn;
    const subProcess = spawnCmd(cmd, args, {
      ...options,
      cwd: this.destination(),
      stdio: [0, 'pipe', 'pipe'],
      env: { PATH: process.env.PATH },
    });

    if (subProcess.stderr) {
      CodecUtil.readLines(subProcess.stderr,
        line => terminal.writer.writeLine(cliTpl`    ${{ identifier: [cmd, ...args].join(' ') }}: ${line.trimEnd()}`).commit());
    }

    return ExecUtil.getResult(subProcess).then(() => { });
  }

  get selfPath(): string {
    return RuntimeIndex.getModule('@travetto/scaffold')!.sourcePath;
  }

  source(file?: string): string {
    return path.resolve(this.selfPath, 'resources', 'templates', this.#template, ...file ? [file] : []);
  }

  destination(file?: string): string {
    return path.resolve(this.#targetDirectory, ...file ? [file] : []);
  }

  get sourceListing(): Promise<Listing> {
    return fs.readFile(this.source('listing.json')).then(JSONUtil.fromBinaryArray<Listing>);
  }

  async resolvedSourceListing(): Promise<[string, ListingEntry][]> {
    const listing = Object.entries(await this.sourceListing)
      .filter(([, entry]) => !entry.requires ||
        Context.#meetsRequirement([...this.#dependencies, ...this.#devDependencies], entry.requires));

    return listing;
  }

  async initialize(): Promise<void> {
    let base = this.destination();
    while (base) {
      if (await fs.stat(`${base}/package.json`).catch(() => { })) {
        throw new Error(`Cannot create project inside of an existing node project ${base}`);
      }
      const next = path.dirname(base);
      if (next === base) {
        break;
      }
      base = next;
    }
  }

  templateContext(): Record<string, unknown> {
    const modules = [...this.#dependencies, ...this.#devDependencies]
      .map(module => path.basename(module))
      .reduce((ctx, value) => ({ ...ctx, [value.replace(/[-]/g, '_')]: true }), {});
    const moduleNames = [...Object.keys(modules)];

    /** Get framework version at runtime */
    const { version: frameworkVersion } = PackageUtil.readPackage(
      PackageUtil.resolveImport('@travetto/manifest/package.json')
    );

    const context = Object.assign(
      {
        frameworkVersion: frameworkVersion.replace(/[.]\d+$/, '.0'),
        name: this.name,
        modules,
        moduleNames,
        dependencies: [...new Set(this.#dependencies)].toSorted((a, b) => a.localeCompare(b)),
        devDependencies: [...new Set(this.#devDependencies)].toSorted((a, b) => a.localeCompare(b)),
      },
      ...this.#featureContexts,
      ...moduleNames.map(module => ({ [`module_${module}`]: true }))
    );

    return context;
  }

  async template(file: string, { rename }: ListingEntry): Promise<void> {
    const contents = await fs.readFile(this.source(file), 'utf-8');
    const out = this.destination(rename ?? file);
    const rendered = mustache.render(
      contents
        .replaceAll('$_', '{{{')
        .replaceAll('_$', '}}}'),
      this.templateContext(),
    )
      .replace(/^[ ]*[/][/][ ]*\n/gsm, '')
      .replace(/[ ]*[/][/][ ]*@ts-expect-error[^\n]*\n/gsm, '') // Excluding errors
      .replace(/^[ ]*[/][/][ ]*[{][{][^\n]*\n/gsm, '') // Excluding conditional comments, full-line
      .replace(/[ ]*[/][/][ ]*[{][{][^\n]*/gsm, ''); // Excluding conditional comments
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, rendered, 'utf8');
  }

  async templateResolvedFiles(): Promise<void> {
    for (const [key, config] of await this.resolvedSourceListing()) {
      await this.template(key, config);
    }
  }

  async resolveFeature(feat: Feature): Promise<void> {
    if (feat.package) {
      const pkgs = Array.isArray(feat.package) ? feat.package : [feat.package];
      for (const pkg of pkgs) {
        if (pkg.startsWith('@travetto')) {
          if (DEV_DEPENDENCIES.has(pkg)) {
            this.#devDependencies.push(pkg);
          } else {
            this.#dependencies.push(pkg);
          }
        } else {
          this.#peerDependencies.push(pkg);
        }
      }
    }
    if (feat.field) {
      this[castKey(feat.field)] = castTo(feat.value);
    }
    if (feat.context) {
      this.#featureContexts.push(feat.context);
    }

    for (const addon of (feat.addons ?? [])) {
      this.resolveFeature(addon);
    }
  }

  async * install(): AsyncIterable<string | undefined> {

    yield cliTpl`${{
      type: 'Templating files'
    }}`;
    await this.templateResolvedFiles();

    yield cliTpl`${{ type: 'Installing dependencies' }} `;
    switch (this.packageManager) {
      case 'npm': await this.#exec('npm', ['i']); break;
      case 'yarn': await this.#exec('yarn', []); break;
      case 'pnpm': await this.#exec('pnpm', ['install']); break;
    }

    yield cliTpl`${{ type: 'Ensuring latest dependencies' }} `;
    switch (this.packageManager) {
      case 'npm': await this.#exec('npm', ['update', '-S']); break;
      case 'yarn': await this.#exec('yarn', ['upgrade']); break;
      case 'pnpm': await this.#exec('pnpm', ['update', '--latest']); break;
    }

    yield cliTpl`${{ type: 'Initial Build' }} `;
    await this.#exec('trvc', ['build'], { spawn: ExecUtil.spawnPackageCommand });
    if (this.#devDependencies.includes('@travetto/eslint')) {
      yield cliTpl`${{ type: 'ESLint Registration' }} `;
      await this.#exec('trv', ['eslint:register'], { spawn: ExecUtil.spawnPackageCommand });
    }

    yield cliTpl`${{ success: 'Successfully created' }} at ${{ path: this.#targetDirectory }} `;
  }
}