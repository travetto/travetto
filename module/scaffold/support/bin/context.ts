import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import rl from 'node:readline/promises';
import path from 'node:path';

import mustache from 'mustache';

import { ExecUtil, Util } from '@travetto/base';
import { cliTpl } from '@travetto/cli';
import { RuntimeIndex, NodePackageManager, PackageUtil } from '@travetto/manifest';
import { Terminal } from '@travetto/terminal';

import { Feature } from './features';

type ListingEntry = { requires?: string[], rename?: string };
type Listing = Record<string, ListingEntry>;

const DEV_DEPS = new Set([
  '@travetto/test',
  '@travetto/pack',
  '@travetto/compiler',
  '@travetto/command',
  '@travetto/transformer',
  '@travetto/eslint',
]);

export class Context {

  static #meetsRequirement(modules: string[], desired: string[]): boolean {
    let valid = true;
    for (const mod of desired) {
      valid = valid && modules.includes(mod);
      if (!valid) {
        break;
      }
    }
    return valid;
  }

  #template: string;
  #targetDir: string;
  #dependencies: string[] = [];
  #devDependencies: string[] = [];
  #peerDependencies: string[] = [];
  #featureContexts: Record<string, unknown>[] = [];

  packageManager: NodePackageManager = 'npm';

  readonly name: string;

  constructor(name: string, template: string, targetDir: string) {
    this.name = name.replace(/[^a-zA-Z0-9]+/, '-').replace(/-+$/, '');
    this.#template = template;
    this.#targetDir = path.resolve(targetDir);
  }

  #exec(cmd: string, args: string[]): Promise<void> {
    const term = new Terminal();
    const proc = spawn(cmd, args, {
      cwd: this.destination(),
      stdio: [0, 'pipe', 'pipe'],
      shell: false,
      env: { PATH: process.env.PATH },
    });

    if (proc.stderr) {
      Util.consumeAsyncItr(rl.createInterface(proc.stderr),
        line => term.writer.writeLine(cliTpl`    ${{ identifier: [cmd, ...args].join(' ') }}: ${line.trimEnd()}`).commit());
    }

    return ExecUtil.getResult(proc).then(() => { });
  }

  get selfPath(): string {
    return RuntimeIndex.getModule('@travetto/scaffold')!.sourcePath;
  }

  source(file?: string): string {
    return path.resolve(this.selfPath, 'resources', 'templates', this.#template, ...file ? [file] : []);
  }

  destination(file?: string): string {
    return path.resolve(this.#targetDir, ...file ? [file] : []);
  }

  get sourceListing(): Promise<Listing> {
    return fs.readFile(this.source('listing.json'), 'utf8').then(val => JSON.parse(val));
  }

  async resolvedSourceListing(): Promise<[string, ListingEntry][]> {
    const res = Object.entries(await this.sourceListing)
      .filter(([, conf]) => !conf.requires ||
        Context.#meetsRequirement([...this.#dependencies, ...this.#devDependencies], conf.requires));

    return res;
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
      .map(x => path.basename(x)).reduce((acc, v) => ({ ...acc, [v.replace(/[-]/g, '_')]: true }), {});
    const moduleNames = [...Object.keys(modules)];

    /** Get framework version at runtime */
    const { version: frameworkVersion } = PackageUtil.readPackage(
      PackageUtil.resolveImport('@travetto/manifest/package.json')
    );

    const context = Object.assign({
      frameworkVersion: frameworkVersion.replace(/[.]\d+$/, '.0'),
      name: this.name,
      modules,
      moduleNames,
      dependencies: [...new Set(this.#dependencies)].sort((a, b) => a.localeCompare(b)),
      devDependencies: [...new Set(this.#devDependencies)].sort((a, b) => a.localeCompare(b)),
    }, ...this.#featureContexts);

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
      .replace(/\/\/\s*@ts-expect-error.*$/gm, '')
      .replace(/(\/\/.*@doc-exclude.*)$/gm, '')
      .replace(/\s*(\/\/.*@doc-exclude.*)/gm, '')
      .replace(/^\s*(\/\/\s*)\n/gsm, '');
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
      if (feat.package.startsWith('@travetto')) {
        if (DEV_DEPS.has(feat.package)) {
          this.#devDependencies.push(feat.package);
        } else {
          this.#dependencies.push(feat.package);
        }
      } else {
        this.#peerDependencies.push(feat.package);
      }
    }
    if (feat.field) {
      // @ts-expect-error
      this[feat.field] = feat.value!;
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
      default: throw new Error(`Unknown package manager: ${this.packageManager} `);
    }

    yield cliTpl`${{ type: 'Ensuring latest dependencies' }} `;
    switch (this.packageManager) {
      case 'npm': await this.#exec('npm', ['update', '-S']); break;
      case 'yarn': await this.#exec('yarn', ['upgrade']); break;
      default: throw new Error(`Unknown package manager: ${this.packageManager} `);
    }

    yield cliTpl`${{ type: 'Initial Build' }} `;
    await this.#exec('npx', ['trvc', 'build']);
    if (this.#devDependencies.includes('@travetto/eslint')) {
      yield cliTpl`${{ type: 'ESLint Registration' }} `;
      await this.#exec('npx', ['trv', 'lint:register']);
    }

    yield cliTpl`${{ success: 'Successfully created' }} at ${{ path: this.#targetDir }} `;
  }
}