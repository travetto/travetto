import * as path from 'path';
import * as fs from 'fs/promises';
import * as mustache from 'mustache';

import { EnvUtil, ExecUtil, FsUtil, PathUtil } from '@travetto/boot';
import { version } from '@travetto/boot/package.json';

import { Feature } from './features';

type ListingEntry = { requires?: string[], rename?: string };
type Listing = Record<string, ListingEntry>;

export class Context {

  static #meetsRequirement(modules: string[], desired: string[]) {
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
  readonly frameworkVersion = version.replace(/[.]\d+$/, '.0');
  readonly author = {
    name: ExecUtil.execSync('git', ['config', 'user.name']).trim() || EnvUtil.get('USER'),
    email: ExecUtil.execSync('git', ['config', 'user.email']).trim()
  };

  constructor(name: string, template: string, targetDir: string) {
    this.name = name;
    this.#template = template;
    this.#targetDir = PathUtil.resolveUnix(targetDir);
  }

  get modules() {
    if (!this.#modules) {
      this.#modules = this.#frameworkDependencies.map(x => x.split('/')).reduce((acc, [, v]) => ({ ...acc, [v]: true }), {});
    }
    return this.#modules;
  }

  get frameworkDependencies() {
    return this.#frameworkDependencies;
  }

  get peerDependencies() {
    return this.#peerDependencies;
  }

  get moduleNames() {
    return [...Object.keys(this.modules)].filter(x => !x.includes('-'));
  }

  source(file?: string) {
    return PathUtil.resolveUnix(__dirname, '..', '..', 'templates', this.#template, ...file ? [file] : []);
  }

  destination(file?: string) {
    return PathUtil.resolveUnix(this.#targetDir, ...file ? [file] : []);
  }

  get sourceListing() {
    return import(this.source('listing.json')) as Promise<Listing>;
  }

  async resolvedSourceListing() {
    return Object.entries(await this.sourceListing)
      .filter(([, conf]) => !conf.requires || Context.#meetsRequirement(this.#frameworkDependencies, conf.requires));
  }

  async initialize() {
    let base = this.destination();
    while (base) {
      if (await FsUtil.exists(`${base}/package.json`)) {
        throw new Error(`Cannot create project inside of an existing node project ${base}`);
      }
      const next = path.dirname(base);
      if (next === base) {
        break;
      }
      base = next;
    }
  }

  async template(file: string, { rename }: ListingEntry) {
    const contents = await fs.readFile(this.source(file), 'utf-8');
    const out = this.destination(rename ?? file);
    const rendered = mustache.render(contents, this).replace(/^\s*(\/\/|#)\s*\n/gsm, '');
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, rendered, 'utf8');
  }

  async templateResolvedFiles() {
    for (const [key, config] of await this.resolvedSourceListing()) {
      await this.template(key, config);
    }
  }

  async addDependency(feat: Feature) {
    if (feat.npm.startsWith('@travetto')) {
      this.#frameworkDependencies.push(feat.npm);
    } else {
      this.#peerDependencies.push(feat.npm);
    }

    for (const addon of (feat.addons ?? [])) {
      this.addDependency(addon);
    }
  }

  exec(cmd: string, args: string[]) {
    return ExecUtil.spawn(cmd, args, { cwd: this.destination(), stdio: [0, 1, 2], isolatedEnv: true }).result;
  }
}