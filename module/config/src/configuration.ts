import { AppError, Class, ClassInstance, Env, Util } from '@travetto/base';
import { DependencyRegistry, Injectable } from '@travetto/di';
import { BindUtil, SchemaRegistry, SchemaValidator, ValidationResultError } from '@travetto/schema';

import { ConfigSourceTarget, ConfigTarget } from './internal/types';
import { ConfigData } from './parser/types';
import { ConfigSource, ConfigValue } from './source/types';

/**
 * Manager for application configuration
 */
@Injectable()
export class Configuration {

  private static getSorted(configs: ConfigValue[], profiles: string[]): ConfigValue[] {
    const order = Object.fromEntries(Object.entries(profiles).map(([k, v]) => [v, +k] as const));

    return configs.sort((left, right) =>
      (order[left.profile] - order[right.profile]) ||
      left.priority - right.priority ||
      left.source.localeCompare(right.source)
    );
  }


  #storage: Record<string, unknown> = {};   // Lowered, and flattened

  #profiles: string[] = ['application', ...Env.getProfiles(), 'override'];
  #sources: string[] = [];

  /**
   * Get a sub tree of the config, or everything if namespace is not passed
   * @param ns The namespace of the config to search for, can be dotted for accessing sub namespaces
   */
  #get(ns?: string): Record<string, unknown> {
    const parts = (ns ? ns.split('.') : []);
    let sub: Record<string, unknown> = this.#storage;

    while (parts.length && sub) {
      const next = parts.shift()!;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      sub = sub[next] as Record<string, unknown>;
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
    const providers = await DependencyRegistry.getCandidateTypes(ConfigSourceTarget);

    const configs = await Promise.all(
      providers.map(async (el) => {
        const inst = await DependencyRegistry.getInstance<ConfigSource>(el.class, el.qualifier);
        return inst.getValues(this.#profiles);
      })
    );

    const sorted = Configuration.getSorted(configs.flat(), this.#profiles);

    this.#sources = sorted.map(x => `${x.profile}.${x.priority} - ${x.source}`);

    for (const { config: element } of sorted) {
      Util.deepAssign(this.#storage, BindUtil.expandPaths(element), 'coerce');
    }
  }

  /**
   * Export all active configuration, useful for displaying active state
   *   - Will not show fields marked as secret
   */
  async exportActive(): Promise<{ sources: string[], active: ConfigData }> {
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
      const data = BindUtil.exportSchema<ConfigData>(inst, { filterField: f => !f.secret, filterValue: v => v !== undefined });
      out[el.class.name] = data;
    }
    return { sources: this.#sources, active: out };
  }

  /**
   * Bind and validate configuration into class instance
   * @param cls
   * @param item
   * @param namespace
   * @param validate
   * @returns
   */
  async bindTo<T>(cls: Class<T>, item: T, namespace: string, validate = true): Promise<T> {
    if (!SchemaRegistry.has(cls)) {
      throw new AppError(`${cls.Ⲑid} is not a valid schema class, config is not supported`);
    }
    const out = BindUtil.bindSchemaToObject(cls, item, this.#get(namespace));
    if (validate) {
      try {
        await SchemaValidator.validate(cls, out);
      } catch (err) {
        if (err instanceof ValidationResultError) {
          err.message = `Failed to construct ${cls.Ⲑid} as validation errors have occurred`;
          err.payload = { class: cls.Ⲑid, file: cls.Ⲑsource, ...(err.payload ?? {}) };
        }
        throw err;
      }
    }
    return out;
  }
}