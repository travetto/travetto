import cp from 'child_process';
import fs from 'fs/promises';
import { render } from 'mustache';

import { path } from '@travetto/boot';
import { Env, Pkg, ExecUtil, ExecutionResult } from '@travetto/base';

import { Feature } from './features';

type ListingEntry = { requires?: string[], rename?: string };
type Listing = Record<string, ListingEntry>;

export class Context {

  static #meetsRequirement(modules: string[], desired: string[]): boolean {
    let valid = true;
    for (const mod of desired) {
      if (mod.endsWith('-')) {
        valid = valid && !!modules.find(m => m.startsWith(mod));
      } else {
        valid = valid && modules.includes(mod);
      }
      if (!valid) {
        break;
      }
    }
    return valid;
  }

  #template: string;
  #targetDir: string;
  #frameworkDependencies: string[] = [];
  #peerDependencies: string[] = [];
  #modules: Record<string, boolean>;

  readonly name: string;
  readonly frameworkVersion = Pkg.mainDigest().framework.replace(/[.]\d+$/, '.0');
  readonly author = {
    name: cp.execSync('git config user.name', { stdio: 'pipe', encoding: 'utf8' }).trim() || Env.get('USER'),
    email: cp.execSync('git config user.email', { stdio: 'pipe', encoding: 'utf8' }).trim()
  };

  constructor(name: string, template: string, targetDir: string) {
    this.name = name;
    this.#template = template;
    this.#targetDir = path.resolve(targetDir);
  }

  get modules(): Record<string, boolean> {
    if (!this.#modules) {
      this.#modules = this.#frameworkDependencies.map(x => x.split('/')).reduce((acc, [, v]) => ({ ...acc, [v]: true }), {});
    }
    return this.#modules;
  }

  get frameworkDependencies(): string[] {
    return this.#frameworkDependencies;
  }

  get peerDependencies(): string[] {
    return this.#peerDependencies;
  }

  get moduleNames(): string[] {
    return [...Object.keys(this.modules)].filter(x => !x.includes('-'));
  }

  source(file?: string): string {
    return path.resolve('resources', 'templates', this.#template, ...file ? [file] : []);
  }

  destination(file?: string): string {
    return path.resolve(this.#targetDir, ...file ? [file] : []);
  }

  get sourceListing(): Promise<Listing> {
    return fs.readFile(this.source('listing.json'), 'utf8').then(val => JSON.parse(val));
  }

  async resolvedSourceListing(): Promise<[string, ListingEntry][]> {
    return Object.entries(await this.sourceListing)
      .filter(([, conf]) => !conf.requires || Context.#meetsRequirement(this.#frameworkDependencies, conf.requires));
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

  async template(file: string, { rename }: ListingEntry): Promise<void> {
    const contents = await fs.readFile(this.source(file), 'utf-8');
    const out = this.destination(rename ?? file);
    const rendered = render(contents, this).replace(/^\s*(\/\/|#)\s*\n/gsm, '');
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, rendered, 'utf8');
  }

  async templateResolvedFiles(): Promise<void> {
    for (const [key, config] of await this.resolvedSourceListing()) {
      await this.template(key, config);
    }
  }

  async addDependency(feat: Feature): Promise<void> {
    if (feat.npm.startsWith('@travetto')) {
      this.#frameworkDependencies.push(feat.npm);
    } else {
      this.#peerDependencies.push(feat.npm);
    }

    for (const addon of (feat.addons ?? [])) {
      this.addDependency(addon);
    }
  }

  exec(cmd: string, args: string[]): Promise<ExecutionResult> {
    return ExecUtil.spawn(cmd, args, { cwd: this.destination(), stdio: [0, 1, 2], isolatedEnv: true }).result;
  }
}