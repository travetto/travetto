import { Dependency, InjectableConfig, ClassTarget, InjectableFactoryConfig } from '../types';
import { InjectionError } from './error';
import { MetadataRegistry, Class, RootRegistry, ChangeEvent } from '@travetto/registry';
import { AppEnv } from '@travetto/base';
import { RetargettingHandler } from '@travetto/compiler';

import * as _ from 'lodash';

export const DEFAULT_INSTANCE = Symbol('__default');

export interface ManagedExtra {
  postConstruct?: () => any
}

type TargetId = string;
type ClassId = string;

function getName(symbol: symbol) {
  return symbol.toString().split(/[()]/g)[1];
}

function mergeWithOptional<T extends { original?: symbol | object, qualifier?: symbol }>(o: T) {
  if (o.original) {
    if (typeof o.original === 'symbol') {
      o.qualifier = o.original;
    } else if (_.isPlainObject(o.original)) {
      _.merge(o, o.original)
    }
    o.original = undefined;
  }
  return o;
}

export class $DependencyRegistry extends MetadataRegistry<InjectableConfig> {
  private pendingFinalize: Class[] = [];

  private instances = new Map<TargetId, Map<Symbol, any>>();
  private instancePromises = new Map<TargetId, Map<Symbol, Promise<any>>>();

  private aliases = new Map<TargetId, Map<Symbol, string>>();
  private targets = new Map<ClassId, Map<Symbol, TargetId>>();

  private proxies = new Map<TargetId, Map<Symbol, Proxy<RetargettingHandler<any>>>>();
  private proxyHandlers = new Map<TargetId, Map<Symbol, RetargettingHandler<any>>>();

  private autoCreate: (Dependency<any> & { priority: number })[] = [];

  constructor() {
    super(RootRegistry);
  }

  async initialInstall() {
    const finalizing = this.pendingFinalize;
    this.pendingFinalize = [];

    for (const cls of finalizing) {
      this.install(cls, { type: 'added', curr: cls });
    }

    // Unblock auto created
    if (this.autoCreate.length && !AppEnv.test) {
      console.debug('Auto-creating', this.autoCreate.map(x => x.target.name));
      const items = this.autoCreate.slice(0).sort((a, b) => a.priority - b.priority);
      for (const i of items) {
        await this.getInstance(i.target, i.qualifier);
      }
    }
  }

  createPending(cls: Class) {
    if (!this.resolved) {
      this.pendingFinalize.push(cls);
    }

    return {
      qualifier: DEFAULT_INSTANCE,
      class: cls,
      target: cls,
      dependencies: {
        fields: {},
        cons: []
      },
      autoCreate: {
        create: false,
        priority: 1000
      }
    };
  }

  async computeDependencies(managed: InjectableConfig<any>) {
    const fieldKeys = Object.keys(managed.dependencies.fields!);

    const consDeps = managed.dependencies.cons || [];
    const allDeps = consDeps.concat(fieldKeys.map(x => managed.dependencies.fields[x]))

    for (const dep of allDeps) {
      mergeWithOptional(dep);
    }

    const promises = allDeps
      .map(async x => {
        try {
          return await this.getInstance(x.target, x.qualifier);
        } catch (e) {
          if (x.optional && e instanceof InjectionError) {
            return undefined;
          } else {
            throw e;
          }
        }
      });

    const all = await Promise.all(promises);

    const consValues = all.slice(0, consDeps.length);
    const fieldValues = all.slice(consDeps.length);

    const fields = new Map<string, any>();
    for (let i = 0; i < fieldKeys.length; i++) {
      fields.set(fieldKeys[i], fieldValues[i]);
    }

    return { consValues, fields }
  }

  applyFieldDependencies(inst: any, fields: Map<string, any>) {
    for (const [key, value] of fields.entries()) {
      inst[key] = value;
    }
  }

  async construct<T>(target: ClassTarget<T & ManagedExtra>, qualifier: symbol = DEFAULT_INSTANCE): Promise<T> {
    const targetId = target.__id;

    const aliasMap = this.aliases.get(targetId);

    if (!aliasMap || !aliasMap.has(qualifier)) {
      throw new InjectionError(`Dependency not found: ${targetId}[${getName(qualifier)}]`);
    }

    const clz = aliasMap.get(qualifier)!;
    const managed = this.get(clz)!;

    const { consValues, fields } = await this.computeDependencies(managed);

    const inst = managed.factory ?
      managed.factory(...consValues) :
      new managed.class(...consValues);

    this.applyFieldDependencies(inst, fields);

    if (inst.postConstruct) {
      await inst.postConstruct();
    }

    return inst;
  }

  private async createInstance<T>(target: ClassTarget<T>, qualifier: symbol = DEFAULT_INSTANCE) {
    const targetId = target.__id;

    if (!this.instances.has(targetId)) {
      this.instances.set(targetId, new Map());
      this.instancePromises.set(targetId, new Map());
    }

    if (this.instancePromises.get(targetId)!.has(qualifier)) {
      return this.instancePromises.get(targetId)!.get(qualifier);
    }

    const instancePromise = this.construct(target, qualifier);
    this.instancePromises.get(targetId)!.set(qualifier, instancePromise);

    const instance = await instancePromise;

    if (AppEnv.watch) {
      if (!this.proxies.has(targetId)) {
        this.proxies.set(targetId, new Map());
        this.proxyHandlers.set(targetId, new Map());
      }
    }

    let out: any = instance;

    console.debug('Creating Instance', targetId, AppEnv.watch,
      !this.proxyHandlers.has(targetId),
      this.proxyHandlers.has(targetId) && !this.proxyHandlers.get(targetId)!.has(qualifier))

    // if in watch mode, create proxies
    if (AppEnv.watch) {
      if (!this.proxies.get(targetId)!.has(qualifier)) {
        const handler = new RetargettingHandler(out);
        const proxy = new Proxy({}, handler);
        this.proxyHandlers.get(targetId)!.set(qualifier, handler);
        this.proxies.get(targetId)!.set(qualifier, proxy);
        out = proxy;
        console.debug('Registering proxy', target.__id, qualifier);
      } else {
        const handler = this.proxyHandlers.get(targetId)!.get(qualifier)!;
        console.debug('Updating target', target.__id, qualifier, out);
        handler.target = out;
        out = this.proxies.get(targetId)!.get(qualifier);
      }
    }

    this.instances.get(targetId)!.set(qualifier, out);
  }

  async getInstance<T>(target: ClassTarget<T>, qualifier: symbol = DEFAULT_INSTANCE): Promise<T> {
    const targetId = target.__id;
    if (!this.instances.has(targetId) || !this.instances.get(targetId)!.has(qualifier)) {
      console.debug('Getting Intance', targetId, getName(qualifier));
      await this.createInstance(target, qualifier);
    }
    return this.instances.get(targetId)!.get(qualifier)!;
  }

  getCandidateTypes<T>(target: Class<T>) {
    const targetId = target.__id;
    const aliasMap = this.aliases.get(targetId)!;
    const aliasedIds = aliasMap ? Array.from(aliasMap.values()) : [];
    return aliasedIds.map(id => this.get(id)!)
  }

  // Undefined indicates no constructor
  registerConstructor<T>(cls: Class<T>, dependencies?: Dependency<any>[]) {
    const conf = this.getOrCreatePending(cls);
    conf.dependencies!.cons = dependencies;
    if (dependencies) {
      for (const dependency of dependencies) {
        dependency.qualifier = dependency.qualifier || DEFAULT_INSTANCE;
      }
    }
  }

  registerProperty<T>(cls: Class<T>, field: string, dependency: Dependency<any>) {
    const conf = this.getOrCreatePending(cls);

    conf.dependencies!.fields[field] = dependency;
    dependency.qualifier = dependency.qualifier || DEFAULT_INSTANCE;
  }

  registerClass<T>(cls: Class<T>, pconfig: Partial<InjectableConfig<T>>) {
    const classId = pconfig.class!.__id;
    const config = this.getOrCreatePending(pconfig.class!);

    if (pconfig.factory) {
      config.factory = pconfig.factory;
    }
    if (pconfig.qualifier) {
      config.qualifier = pconfig.qualifier;
    }
    if (pconfig.target) {
      config.target = pconfig.target;
    }
    if (pconfig.autoCreate) {
      config.autoCreate!.create = pconfig.autoCreate.create;
      if (pconfig.autoCreate.priority !== undefined) {
        config.autoCreate!.priority = pconfig.autoCreate.priority;
      }
    }
    if (pconfig.dependencies) {
      config.dependencies = { fields: {}, ...pconfig.dependencies };
    }
  }

  registerFactory(config: InjectableFactoryConfig<any> & { fn: (...args: any[]) => any, id?: string }) {
    const finalConfig: InjectableConfig<any> = {} as any;

    mergeWithOptional(config);

    if (typeof config.autoCreate === 'boolean') {
      finalConfig.autoCreate = { create: config.autoCreate } as any;
    }

    finalConfig.factory = config.fn;
    finalConfig.target = config.class;

    if (config.qualifier) {
      finalConfig.qualifier = config.qualifier;
    }

    finalConfig.dependencies = { fields: {} };

    if (config.dependencies) {
      finalConfig.dependencies.cons = config.dependencies;
    }

    // Create mock cls for DI purposes
    const cls = { __id: config.id || `${config.class.__id}#${config.fn.name}` } as any;

    finalConfig.class = cls;

    this.registerClass(cls, finalConfig);
  }

  onInstallFinalize<T>(cls: Class<T>) {
    const classId = cls.__id;

    const config = this.getOrCreatePending(cls) as InjectableConfig<T>;

    // Allow for the factory to fulfill the target
    const parentClass = config.factory ? config.target : Object.getPrototypeOf(cls);
    const parentConfig = this.get(parentClass.__id);

    if (parentConfig) {
      config.dependencies.fields = {
        ...parentConfig.dependencies!.fields,
        ...config.dependencies.fields
      };

      // Inherit cons deps if no constructor defined
      if (config.dependencies.cons === undefined) {
        config.dependencies.cons = parentConfig.dependencies.cons;
      }
    }

    if (!this.targets.has(classId)) {
      this.targets.set(classId, new Map());
    }

    const targetId = config.target.__id;

    if (!this.aliases.has(targetId)) {
      this.aliases.set(targetId, new Map());
    }

    this.aliases.get(targetId)!.set(config.qualifier, classId);
    this.targets.get(classId)!.set(config.qualifier, targetId);

    // TODO: Auto alias parent class if framework managed
    if (parentClass.__id && config.qualifier !== DEFAULT_INSTANCE) {
      const parentId = parentClass.__id;
      this.aliases.get(parentId)!.set(config.qualifier, classId);
      this.targets.get(classId)!.set(config.qualifier, parentId);
    }

    // If already loaded, reload
    if (AppEnv.watch &&
      this.proxies.has(targetId) &&
      this.proxies.get(targetId)!.has(config.qualifier)
    ) {
      console.debug('Reloading on next tick');
      // Timing matters b/c of create instance
      process.nextTick(() => this.createInstance(config.target, config.qualifier));
    } else if (config.autoCreate.create) {
      // If not loaded, and autocreate
      this.autoCreate.push({
        target: config.target,
        qualifier: config.qualifier,
        priority: config.autoCreate.priority!
      })
    }

    return config;
  }

  onUninstallFinalize(cls: Class) {
    if (!this.targets.has(cls.__id)) {
      return;
    }

    // Remove current instance
    for (const [config, targetId] of this.targets.get(cls.__id)!.entries()) {
      if (this.instances.has(targetId) &&
        this.instances.get(targetId)!.has(config) &&
        this.instances.get(targetId)!.get(config).constructor.__id === cls.__id
      ) {
        const handler = this.proxyHandlers.get(targetId)!.get(config)
        if (handler) {
          handler.target = null;
        }

        this.instances.get(targetId)!.delete(config);
        this.instancePromises.get(targetId)!.delete(config);
        console.debug('On uninstall', cls.__id, config, targetId, handler);
        this.targets.get(cls.__id)!.delete(config);
      }
    }
  }

  onReset() {
    super.onReset();
    this.pendingFinalize = [];
    this.instances.clear();
    this.instancePromises.clear();
    this.proxies.clear();
    this.proxyHandlers.clear();
    this.aliases.clear();
    this.targets.clear();
    this.autoCreate = [];
  }
}

export const DependencyRegistry = new $DependencyRegistry();