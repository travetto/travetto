import { Util, SimpleObject } from '@travetto/base';

import { ConfigUtil } from './internal/util';

/**
 * Manager for application configuration
 */
class $ConfigManager {

  private initialized?: boolean = false;
  private storage = {};   // Lowered, and flattened
  private redactedKeys = [
    'passphrase.*',
    'password.*',
    'credential.*',
    '.*secret.*',
    '.*key',
    '.*token',
    'pw',
  ];

  /*
    Order of specificity (least to most)
      - Resource application.yml
      - Resource {profile}.yml
      - Resource {env}.yml
      - Environment vars -> Overrides everything (happens at bind time)
  */
  async init() {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    await this.load();
  }

  /**
   * Load all config files
   */
  async load() {
    this.reset();
    const files = await ConfigUtil.fetchOrderedConfigs();

    if (files.length) {
      console.debug('Found configurations for', { files: files.map(x => x.profile) });
    }

    for (const f of files) {
      this.putAll(await ConfigUtil.getConfigFileAsData(f.file));
    }
  }

  /**
   * Get a sub tree of the config, or everything if key is not passed
   */
  get(key?: string): SimpleObject {
    return this.bindTo({}, key);
  }

  /**
   * Get a sub tree with sensitive fields redacted
   */
  getSecure(key?: string) {
    return ConfigUtil.sanitizeValuesByKey(this.get(key), [
      ...this.redactedKeys,
      (this.get('config')?.redacted ?? []) as string[]
    ].flat());
  }

  /**
   * Output to JSON
   */
  toJSON() {
    return this.storage;
  }

  /**
   * Reset
   */
  reset() {
    this.storage = {};
  }

  /**
   * Update config with a full subtree
   */
  putAll(data: SimpleObject) {
    Util.deepAssign(this.storage, ConfigUtil.breakDownKeys(data), 'coerce');
  }

  /**
   * Apply config subtree to a given object
   */
  bindTo<T extends object>(obj: T, key?: string): T {
    return ConfigUtil.bindTo(this.storage, obj, key);
  }
}

export const ConfigManager = new $ConfigManager();