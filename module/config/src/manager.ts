import { Util } from '@travetto/base';

import { ConfigUtil, Nested } from './internal/util';

/**
 * Manager for application configuration
 */
export class ConfigManager {

  private static initialized: boolean = false;
  private static storage = {};   // Lowered, and flattened
  private static redactedKeys = [
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
  static init() {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.load();
  }

  /**
   * Load all config files
   */
  static load() {
    this.reset();
    const files = ConfigUtil.fetchOrderedConfigs();

    if (files.length) {
      console.debug('Found configurations for', files.map(x => x.profile));
    }

    for (const f of files) {
      this.putAll(ConfigUtil.getConfigFileAsData(f.file));
    }
  }

  /**
   * Get a sub tree of the config, or everything if key is not passed
   */
  static get(key?: string) {
    return this.bindTo({}, key);
  }

  /**
   * Get a sub tree with sensitive fields redacted
   */
  static getSecure(key?: string) {
    return ConfigUtil.sanitizeValuesByKey(this.get(key), [
      ...this.redactedKeys,
      this.get('config')?.redacted ?? []
    ].flat());
  }

  /**
   * Output to JSON
   */
  static toJSON() {
    return this.storage;
  }

  /**
   * Reset
   */
  static reset() {
    this.storage = {};
  }

  /**
   * Update config with a full subtree
   */
  static putAll(data: Nested) {
    Util.deepAssign(this.storage, ConfigUtil.breakDownKeys(data), 'coerce');
  }

  /**
   * Apply config subtree to a given object
   */
  static bindTo(obj: any, key?: string): Record<string, any> {
    return ConfigUtil.bindTo(this.storage, obj, key);
  }
}