import { Class, Dependency, InjectableConfig, ClassTarget } from '../types';
import { AppInfo, RetargettingHandler, bulkRequire } from '@encore/base';
import * as path from 'path';
import { InjectionError } from './error';
import { externalPromise } from '@encore/util';

export const DEFAULT_INSTANCE = '__default';

export interface ManagedExtra {
  postConstruct?: () => any
}

const SEP = path.sep;
const RE_SEP = SEP === '/' ? '\\/' : SEP;
const SRC_RE = new RegExp(`${RE_SEP}src${RE_SEP}`, 'g');
const PATH_RE = new RegExp(RE_SEP, 'g');

function getId<T>(cls: Class<T> | ClassTarget<T>): string {
  let target = cls as any;

  if (!target.__id) {
    let rootName = cls.__filename!
      .split(process.cwd())[1]
      .replace(SRC_RE, SEP)
      .replace(PATH_RE, '.')
      .replace(/^\./, '')
      .replace(/\.(t|j)s$/, '');

    target.__id = `${rootName}#${cls.name}`;
  }
  return target.__id;
}

export class Registry {
  static injectables = new Map<string, InjectableConfig<any>>();
  static instances = new Map<string, Map<string, any>>();
  static proxyHandlers = new Map<string, Map<string, any>>();

  static aliases = new Map<string, Map<string, string>>();
  static byAnnotation = new Map<Function, Set<string>>();

  private static _waitingForInit = false;
  static initalized = externalPromise();

  static register<T>(pconfig: Partial<InjectableConfig<T>>) {
    pconfig.name = pconfig.name || DEFAULT_INSTANCE;
    pconfig.dependencies = pconfig.dependencies || {} as any;
    pconfig.target = pconfig.target || pconfig.class;
    pconfig.annotations = pconfig.annotations || [];

    const config = pconfig as InjectableConfig<T>;
    config.dependencies.cons = config.dependencies.cons || [];
    config.dependencies.fields = config.dependencies.fields || {};

    for (let dep of config.dependencies.cons) {
      dep.name = dep.name || DEFAULT_INSTANCE;
    }

    for (let key of Object.keys(config.dependencies.fields)) {
      let obj = config.dependencies.fields[key];
      obj.name = obj.name || DEFAULT_INSTANCE;
    }

    let classId = getId(config.class);
    let targetId = getId(config.target);

    this.injectables.set(classId, config);

    if (!this.aliases.has(targetId)) {
      this.aliases.set(targetId, new Map());
    }

    this.aliases.get(targetId)!.set(config.name, classId);

    for (let anno of config.annotations) {
      if (!this.byAnnotation.has(anno)) {
        this.byAnnotation.set(anno, new Set());
      }
      this.byAnnotation.get(anno)!.add(classId);
    }

    // Live RELOAD
    if (AppInfo.WATCH_MODE &&
      this.proxyHandlers.has(targetId) &&
      this.proxyHandlers.get(targetId)!.has(config.name)
    ) {
      this.createInstance(config.target, config.name);
    }
  }

  static async construct<T>(target: ClassTarget<T & ManagedExtra>, name: string = DEFAULT_INSTANCE): Promise<T> {
    let targetId = getId(target);

    let aliasMap = this.aliases.get(targetId);

    if (!aliasMap || !aliasMap.has(name)) {
      throw new InjectionError(`Dependency not found: ${targetId}[${name}]`);
    }

    let clz = aliasMap.get(name)!;
    let managed = this.injectables.get(clz)!;

    const fieldKeys = Object.keys(managed.dependencies.fields!);

    const promises =
      managed.dependencies.cons
        .concat(fieldKeys.map(x => managed.dependencies.fields[x]))
        .map(async x => {
          try {
            return await this.getInstance(x.target, x.name);
          } catch (e) {
            if (x.optional && e instanceof InjectionError) {
              return undefined;
            } else {
              throw e;
            }
          }
        });

    const allDeps = await Promise.all(promises);

    const consValues = allDeps.slice(0, managed.dependencies.cons.length);
    const fieldValues = allDeps.slice(managed.dependencies.cons.length);

    const inst = new managed.class(...consValues);

    for (let i = 0; i < fieldKeys.length; i++) {
      (inst as any)[fieldKeys[i]] = fieldValues[i];
    }

    if (inst.postConstruct) {
      await inst.postConstruct();
    }
    return inst;
  }

  private static async createInstance<T>(target: ClassTarget<T>, name: string = DEFAULT_INSTANCE) {
    let instance = await this.construct(target, name);
    let targetId = getId(target);

    if (!this.instances.has(targetId)) {
      this.instances.set(targetId, new Map());
      this.proxyHandlers.set(targetId, new Map());
    }

    let out: any = instance;

    if (AppInfo.WATCH_MODE) {
      if (!this.instances.has(targetId) || !this.instances.get(targetId)!.has(name)) {
        console.log('Registering proxy', target.name, name);
        let handler = new RetargettingHandler(out);
        out = new Proxy({}, handler);
        this.proxyHandlers.get(targetId)!.set(name, handler);
      } else {
        console.log('Updating target');
        this.proxyHandlers.get(targetId)!.get(name)!.target = out;
        // Don't re-set instance
        return;
      }
    }

    this.instances.get(targetId)!.set(name, out);
  }

  static async getInstance<T>(target: ClassTarget<T>, name: string = DEFAULT_INSTANCE): Promise<T> {
    let targetId = getId(target);
    if (!this.instances.has(targetId) || !this.instances.get(targetId)!.has(name)) {
      await this.createInstance(target, name);
    }
    return this.instances.get(targetId)!.get(name)!;
  }

  static async initialize() {
    if (this._waitingForInit) {
      return await this.initalized;
    } else {
      this._waitingForInit = true;
      let globs = (process.env.SCAN_GLOBS || 'src/**/*.ts').split(/\s+/);
      for (let glob of globs) {
        bulkRequire(glob);
      }
      this.initalized.resolve(true);
    }
  }
}