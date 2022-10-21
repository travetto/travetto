import * as path from 'path';

import { AppError, AppManifest, Class, ResourceManager, Util } from '@travetto/base';
import { EnvUtil } from '@travetto/boot';
import { BindUtil, SchemaRegistry, SchemaValidator, ValidationResultError } from '@travetto/schema';

import { ConfigUtil } from './internal/util';

/**
 * Manager for application configuration
 */
class $ConfigManager {

  #initialized?: boolean = false;
  #storage: Record<string, unknown> = {};   // Lowered, and flattened
  #active: Record<string, Record<string, unknown>> = {}; // All active configs
  #redactedKeys = [
    'passphrase.*',
    'password.*',
    'credential.*',
    '.*secret.*',
    '.*key',
    '.*token',
    'pw',
  ];

  protected getStorage(): Record<string, unknown> {
    return this.#storage;
  }

  /**
   * Load all config files
   */
  async #load(): Promise<void> {
    const profileIndex = Object.fromEntries(Object.entries(AppManifest.env.profiles).map(([k, v]) => [v, +k] as const));

    const files = (await ResourceManager.findAll(/[.]ya?ml$/))
      .map(file => ({ file, profile: path.basename(file).replace(/[.]ya?ml$/, '') }))
      .filter(({ profile }) => profile in profileIndex)
      .sort((a, b) => profileIndex[a.profile] - profileIndex[b.profile]);

    if (files.length) {
      console.debug('Found configurations for', { files: files.map(x => x.profile) });
    }

    for (const f of files) {
      const data = await ConfigUtil.getConfigFileAsData(f.file);
      Util.deepAssign(this.#storage, BindUtil.expandPaths(data), 'coerce');
    }
  }

  /**
   * Get a sub tree of the config, or everything if namespace is not passed
   * @param ns The namespace of the config to search for, can be dotted for accessing sub namespaces
   */
  #get(ns?: string): Record<string, unknown> {
    return ConfigUtil.lookupRoot(this.#storage, ns);
  }

  /**
   * Order of specificity (least to most)
   *   - Resource application.yml
   *   - Resource {profile}.yml
   *   - Resource {env}.yml
   *   - Environment vars -> Overrides everything (happens at bind time)
   */
  async init(): Promise<void> {
    if (!this.#initialized) {
      this.#initialized = true;
      await this.#load();
    }
  }

  /**
   * Output to JSON
   * @param namespace If only a portion of the config should be exported
   * @param secure Determines if secrets should be redacted, defaults to true in prod, false otherwise
   */
  toJSON(secure: boolean = EnvUtil.isProd()): Record<string, unknown> {
    const copy = structuredClone(this.#active);
    return secure ?
      ConfigUtil.sanitizeValuesByKey(copy, [
        ...this.#redactedKeys,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        ...(this.#get('config')?.redacted ?? []) as string[]
      ]) :
      copy;
  }

  /**
   * Bind config to a schema class
   * @param cls
   * @param item
   * @param namespace
   */
  bindTo<T>(cls: Class<T>, item: T, namespace: string): T {
    if (!SchemaRegistry.has(cls)) {
      throw new AppError(`${cls.Ⲑid} is not a valid schema class, config is not supported`);
    }

    const cfg = Util.deepAssign({}, this.#get(namespace));
    Util.deepAssign(cfg, ConfigUtil.getEnvOverlay(cls, namespace));

    return BindUtil.bindSchemaToObject(cls, item, cfg);
  }

  async install<T>(cls: Class<T>, item: T, namespace: string, internal?: boolean): Promise<T> {
    const out = await this.bindTo(cls, item, namespace);
    try {
      await SchemaValidator.validate(cls, out);
    } catch (err) {
      if (err instanceof ValidationResultError) {
        err.message = `Failed to construct ${cls.Ⲑid} as validation errors have occurred`;
        err.payload = { class: cls.Ⲑid, file: cls.Ⲑfile, ...(err.payload ?? {}) };
      }
      throw err;
    }
    if (out && !internal) {
      Util.deepAssign(ConfigUtil.lookupRoot(this.#active, namespace, true), out, 'coerce');
    }
    return out;
  }

  /**
   * Reset
   */
  reset(): void {
    this.#storage = {};
    this.#initialized = false;
  }
}

export const ConfigManager = new $ConfigManager();