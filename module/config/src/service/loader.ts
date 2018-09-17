import * as path from 'path';
import * as yaml from 'js-yaml';
import { readFileSync } from 'fs';

import { Env, ScanApp } from '@travetto/base';

import { ConfigMap } from './map';

const YAML_RE = /.ya?ml$/;

export class ConfigLoader {

  private static _initialized: boolean = false;
  private static map = new ConfigMap();

  private static processConfigs() {
    // Load all namespaces from core
    const entries = ScanApp.findFiles(YAML_RE, x => /config\/[^/]+.yml$/.test(x));

    for (const entry of entries) {
      this.processConfig(entry.file);
    }
  }

  private static processProfiles() {
    // Handle profile loads
    if (Env.profiles.length) {
      const envFiles = ScanApp.findFiles(YAML_RE, x => x.startsWith('profile/'))
        .map(x => ({ name: x.file, data: readFileSync(x.file).toString() }))
        .map(x => {
          const tested = path.basename(x.name).replace(YAML_RE, '');
          const found = Env.hasProfile(tested);
          return { name: tested, found, data: x.data };
        })
        .filter(x => x.found);

      console.debug('Found configurations for', envFiles.map(x => x.name));

      for (const file of envFiles) {
        yaml.safeLoadAll(file.data, doc => this.map.putAll(doc));
      }
    }
  }

  static get(key: string) {
    return this.map.get(key);
  }

  static bindTo(obj: any, key: string) {
    this.map.bindTo(obj, key);
  }

  static processConfig(file: string) {
    const data = readFileSync(file).toString();
    const ns = path.basename(file).replace(YAML_RE, '');
    yaml.safeLoadAll(data, doc => this.map.putAll({ [ns]: doc }));
  }

  /*
    Order of specificity (least to most)
      - Module configs -> located in the node_modules/@travetto/<*>/config folder
      - Local configs -> located in the config folder
      - External config file -> loaded from env
      - Environment vars -> Overrides everything (happens at bind time)
  */
  static initialize() {
    if (this._initialized) {
      return;
    }
    this.map.reset();
    this._initialized = true;

    this.processConfigs();
    this.processProfiles();

    if (!Env.isTrue('QUIET_CONFIG') && !Env.test) {
      console.info(`Initializing: ${Env.profiles.join(',')}`);
      console.info('Configured', this.map.toJSON());
    }
  }
}