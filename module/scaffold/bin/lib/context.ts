import * as path from 'path';
import * as fs from 'fs';
import * as mustache from 'mustache';

import { EnvUtil, ExecUtil, FsUtil, PathUtil } from '@travetto/boot';
import { version } from '@travetto/boot/package.json';

import { Feature } from './features';

export class Context {

  static #finalize(pth: string) {
    return pth.replace('gitignore.txt', '.gitignore')
      .replace('package.json.txt', 'package.json');
  }

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

  readonly name: string;
  readonly frameworkVersion = version.replace(/[.]\d+$/, '.0');
  readonly author = {
    name: ExecUtil.execSync('git', ['config', 'user.name']).trim() || EnvUtil.get('USER'),
    email: ExecUtil.execSync('git', ['config', 'user.email']).trim()
  };

  frameworkDependencies: string[] = [];
  peerDependencies: string[] = [];
  #modules: Record<string, boolean> = {};

  constructor(name: string, template: string, targetDir: string) {
    this.name = name;
    this.#template = template;
    this.#targetDir = PathUtil.resolveUnix(targetDir);
  }

  get modules() {
    if (!this.#modules) {
      this.#modules = this.frameworkDependencies.map(x => x.split('/')).reduce((acc, [, v]) => ({ ...acc, [v]: true }), {});
    }
    return this.#modules;
  }

  source(file?: string) {
    return PathUtil.resolveUnix(__dirname, '..', '..', 'templates', this.#template, ...file ? [file] : []);
  }

  destination(file?: string) {
    return PathUtil.resolveUnix(this.#targetDir, ...file ? [file] : []);
  }

  get sourceListing() {
    return import(this.source('listing.json')) as Promise<Record<string, { requires?: string[] }>>;
  }

  async resolvedSourceListing() {
    return Object.entries(await this.sourceListing)
      .filter(([, conf]) => !conf.requires || Context.#meetsRequirement(this.frameworkDependencies, conf.requires));
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

  async template(file: string) {
    const contents = await fs.promises.readFile(this.source(file), 'utf-8');
    const rendered = mustache.render(contents, this).replace(/^\s*(\/\/|#)\s*\n/gsm, '');
    await FsUtil.mkdirp(path.dirname(this.destination(file)));
    await fs.promises.writeFile(Context.#finalize(this.destination(file)), rendered, 'utf8');
  }

  async templateResolvedFiles() {
    for (const [key] of await this.resolvedSourceListing()) {
      await this.template(key);
    }
  }

  async addDependency(feat: Feature) {
    if (feat.npm.startsWith('@travetto')) {
      this.frameworkDependencies.push(feat.npm);
    } else {
      this.peerDependencies.push(feat.npm);
    }

    for (const addon of (feat.addons ?? [])) {
      this.addDependency(addon);
    }
  }
}