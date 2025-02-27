import util from 'node:util';

import { AppError, toConcrete, castTo, Class, ClassInstance, Env, Runtime, RuntimeResources } from '@travetto/runtime';
import { DependencyRegistry, Injectable } from '@travetto/di';
import { BindUtil, DataUtil, SchemaRegistry, SchemaValidator, ValidationResultError } from '@travetto/schema';

import { ConfigTarget } from './internal/types';
import { ParserManager } from './parser/parser';
import { ConfigData } from './parser/types';
import { ConfigSource, ConfigSpec } from './source/types';
import { FileConfigSource } from './source/file';
import { OverrideConfigSource } from './source/override';

type ConfigSpecSimple = Omit<ConfigSpec, 'data'>;

/**
 * Manager for application configuration
 */
@Injectable()
export class ConfigurationService {

  #storage: Record<string, unknown> = {};   // Lowered, and flattened
  #specs: ConfigSpecSimple[] = [];
  #secrets: (RegExp | string)[] = [/secure(-|_|[a-z])|password|private|secret|salt|(\bkey|key\b)|serviceAccount|(api(-|_)?key)/i];

  /**
   * Get a sub tree of the config, or everything if namespace is not passed
   * @param ns The namespace of the config to search for, can be dotted for accessing sub namespaces
   */
  #get(ns?: string): Record<string, unknown> {
    const parts = (ns ? ns.split('.') : []);
    let sub: Record<string, unknown> = this.#storage;

    while (parts.length && sub) {
      const next = parts.shift()!;
      sub = castTo(sub[next]);
    }

    return sub;
  }

  /**
   * Load configurations for active profiles.  Load order is defined by:
   *  - First in order of profile names (application, ...specified, override)
   *  - When dealing with two profiles of the same name, they are then sorted by priority
   *  - If of the same priority, then alpha sort on the source
   */
  async postConstruct(): Promise<void> {
    const providers = await DependencyRegistry.getCandidateTypes(toConcrete<ConfigSource>());

    const configs = await Promise.all(
      providers.map(async (el) => await DependencyRegistry.getInstance(el.class, el.qualifier))
    );

    const parser = await DependencyRegistry.getInstance(ParserManager);

    const possible = await Promise.all([
      new FileConfigSource(parser),
      ...configs,
      new OverrideConfigSource()
    ].map(src => src.get()));

    const specs = possible
      .flat()
      .filter(x => !!x)
      .sort((a, b) => a.priority - b.priority);

    for (const spec of specs) {
      DataUtil.deepAssign(this.#storage, BindUtil.expandPaths(spec.data), 'coerce');
    }

    this.#specs = specs.map(({ data, ...v }) => v);

    // Initialize Secrets
    const userSpecified = (this.#get('config')?.secrets ?? []);
    for (const el of Array.isArray(userSpecified) ? userSpecified : [userSpecified]) {
      if (el !== undefined && el !== null && typeof el === 'string') {
        if (el.startsWith('/')) {
          this.#secrets.push(DataUtil.coerceType(el, RegExp, true));
        } else {
          this.#secrets.push(DataUtil.coerceType(el, String, true));
        }
      }
    }
  }

  /**
   * Export all active configuration, useful for displaying active state
   *   - Will not show fields marked as secret
   */
  async exportActive(): Promise<{ sources: ConfigSpecSimple[], active: ConfigData }> {
    const configTargets = await DependencyRegistry.getCandidateTypes(ConfigTarget);
    const configs = await Promise.all(
      configTargets
        .filter(el => el.qualifier === DependencyRegistry.get(el.class).qualifier) // Is primary?
        .sort((a, b) => a.class.name.localeCompare(b.class.name))
        .map(async el => {
          const inst = await DependencyRegistry.getInstance<ClassInstance>(el.class, el.qualifier);
          return [el, inst] as const;
        })
    );
    const out: Record<string, ConfigData> = {};
    for (const [el, inst] of configs) {
      const data = BindUtil.bindSchemaToObject<ConfigData>(
        inst.constructor, {}, inst, { filterField: f => !f.secret, filterValue: v => v !== undefined }
      );
      out[el.class.name] = DataUtil.filterByKeys(data, this.#secrets);
    }
    return { sources: this.#specs, active: out };
  }

  /**
   * Bind and validate configuration into class instance
   */
  async bindTo<T>(cls: Class<T>, item: T, namespace: string, validate = true): Promise<T> {
    const classId = cls.Ⲑid;
    if (!SchemaRegistry.has(cls)) {
      throw new AppError(`${classId} is not a valid schema class, config is not supported`);
    }
    BindUtil.bindSchemaToObject(cls, item, this.#get(namespace));
    if (validate) {
      try {
        await SchemaValidator.validate(cls, item);
      } catch (err) {
        if (err instanceof ValidationResultError) {
          const ogMessage = err.message;
          err.message = `Failed to construct ${classId} as validation errors have occurred`;
          err.stack = err.stack?.replace(ogMessage, err.message);
          const imp = Runtime.getImport(cls);
          Object.defineProperty(err, 'details', { value: { class: classId, import: imp, ...(err.details ?? {}) } });
        }
        throw err;
      }
    }
    return item;
  }

  /**
   * Log current configuration state
   */
  async initBanner(): Promise<void> {
    const ogDepth = util.inspect.defaultOptions.depth;
    util.inspect.defaultOptions.depth = 100;

    console.log('Initialized', {
      manifest: {
        main: Runtime.main,
        workspace: Runtime.workspace
      },
      runtime: {
        env: Runtime.env,
        debug: Runtime.debug,
        production: Runtime.production,
        dynamic: Runtime.dynamic,
        resourcePaths: RuntimeResources.searchPaths,
        profiles: Env.TRV_PROFILES.list ?? []
      },
      config: await this.exportActive()
    });
    util.inspect.defaultOptions.depth = ogDepth;
  }
}