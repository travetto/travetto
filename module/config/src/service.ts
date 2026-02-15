import util from 'node:util';

import { RuntimeError, toConcrete, castTo, type Class, Env, Runtime, RuntimeResources, getClass } from '@travetto/runtime';
import { DependencyRegistryIndex, getDefaultQualifier, Injectable } from '@travetto/di';
import { BindUtil, DataUtil, SchemaRegistryIndex, SchemaValidator, ValidationResultError } from '@travetto/schema';

import { ParserManager } from './parser/parser.ts';
import type { ConfigData } from './parser/types.ts';
import type { ConfigSource, ConfigPayload } from './source/types.ts';
import { FileConfigSource } from './source/file.ts';
import { OverrideConfigSource } from './source/override.ts';

type ConfigSpecSimple = Omit<ConfigPayload, 'data'>;

/**
 * Common Type for all configuration classes
 */
export class ConfigBaseType { }

/**
 * Manager for application configuration
 */
@Injectable()
export class ConfigurationService {

  #storage: Record<string, unknown> = {};   // Lowered, and flattened
  #payloads: ConfigSpecSimple[] = [];
  #secrets: (RegExp | string)[] = [/secure(-|_|[a-z])|password|private|secret|salt|(\bkey|key\b)|serviceAccount|(api(-|_)?key)/i];

  /**
   * Get a sub tree of the config, or everything if namespace is not passed
   * @param namespace The namespace of the config to search for, can be dotted for accessing sub namespaces
   */
  #get<T extends Record<string, unknown> = Record<string, unknown>>(namespace?: string): T {
    const parts = (namespace ? namespace.split('.') : []);
    let sub: Record<string, unknown> = this.#storage;

    while (parts.length && sub) {
      const next = parts.shift()!;
      sub = castTo(sub[next]);
    }

    return castTo(sub);
  }

  /**
   * Load configurations for active profiles.  Load order is defined by:
   *  - First in order of profile names (application, ...specified, override)
   *  - When dealing with two profiles of the same name, they are then sorted by priority
   *  - If of the same priority, then alpha sort on the source
   */
  async postConstruct(): Promise<void> {
    const providers = DependencyRegistryIndex.getCandidates(toConcrete<ConfigSource>());

    const configs = await Promise.all(
      providers.map(async (candidate) => await DependencyRegistryIndex.getInstance<ConfigSource>(candidate.candidateType, candidate.qualifier))
    );

    const parser = await DependencyRegistryIndex.getInstance(ParserManager);

    const possible = await Promise.all([
      new FileConfigSource(parser),
      ...configs,
      new OverrideConfigSource()
    ].map(async source => source.get()));

    const payloads = possible
      .flat()
      .filter(data => !!data)
      .toSorted((a, b) => a.priority - b.priority);

    for (const payload of payloads) {
      DataUtil.deepAssign(this.#storage, BindUtil.expandPaths(payload.data), 'coerce');
    }

    this.#payloads = payloads.map(({ data: _, ...payload }) => payload);

    // Initialize Secrets
    const { secrets = [] } = this.#get<{ secrets?: string | string[] }>('config') ?? {};
    for (const value of [secrets].flat()) {
      if (typeof value === 'string') {
        if (value.startsWith('/')) {
          this.#secrets.push(DataUtil.coerceType(value, RegExp, true));
        } else {
          this.#secrets.push(DataUtil.coerceType(value, String, true));
        }
      }
    }
  }

  /**
   * Export all active configuration, useful for displaying active state
   *   - Will not show fields marked as secret
   */
  async exportActive(): Promise<{ sources: ConfigSpecSimple[], active: ConfigData }> {
    const configTargets = DependencyRegistryIndex.getCandidates(ConfigBaseType);
    const configs = await Promise.all(
      configTargets
        .filter(candidate => candidate.qualifier === getDefaultQualifier(candidate.class)) // Is self targeting?
        .toSorted((a, b) => a.class.name.localeCompare(b.class.name))
        .map(async candidate => {
          const inst = await DependencyRegistryIndex.getInstance(candidate.class, candidate.qualifier);
          return [candidate, inst] as const;
        })
    );
    const out: Record<string, ConfigData> = {};
    for (const [candidate, inst] of configs) {
      const data = BindUtil.bindSchemaToObject<ConfigData>(
        getClass(inst), {}, inst, { filterInput: field => !('secret' in field) || !field.secret, filterValue: value => value !== undefined }
      );
      out[candidate.candidateType.name] = DataUtil.filterByKeys(data, this.#secrets);
    }
    return { sources: this.#payloads, active: out };
  }

  /**
   * Bind and validate configuration into class instance
   */
  async bindTo<T>(cls: Class<T>, item: T, namespace: string, validate = true): Promise<T> {
    const classId = cls.Ⲑid;
    if (!SchemaRegistryIndex.has(cls)) {
      throw new RuntimeError(`${classId} is not a valid schema class, config is not supported`);
    }
    BindUtil.bindSchemaToObject(cls, item, this.#get(namespace));
    if (validate) {
      try {
        await SchemaValidator.validate(cls, item);
      } catch (error) {
        if (error instanceof ValidationResultError) {
          const originalMessage = error.message;
          error.message = `Failed to construct ${classId} as validation errors have occurred`;
          error.stack = error.stack?.replace(originalMessage, error.message);
          const imp = Runtime.getImport(cls);
          Object.defineProperty(error, 'details', { value: { class: classId, import: imp, ...(error.details ?? {}) } });
        }
        throw error;
      }
    }
    return item;
  }

  /**
   * Produce the visible configuration state and runtime information
   */
  async initBanner(): Promise<string> {
    return util.inspect({
      manifest: {
        main: Runtime.main,
        workspace: Runtime.workspace
      },
      runtime: {
        production: Runtime.production,
        role: Runtime.role,
        debug: Runtime.debug,
        resourcePaths: RuntimeResources.searchPaths,
        profiles: Env.TRV_PROFILES.list ?? []
      },
      config: await this.exportActive()
    }, {
      ...util.inspect.defaultOptions,
      depth: 100,
      colors: false, // Colors are not useful in logs
    });
  }
}