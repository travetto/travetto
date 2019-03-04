import * as path from 'path';
import { readFileSync } from 'fs';

import { Env, ResourceManager, ScanApp } from '@travetto/base';
import { YamlUtil } from '@travetto/yaml';

import { ConfigMap } from './map';

export class ConfigLoader {

  private static initialized: boolean = false;
  private static map = new ConfigMap();

  private static processConfigs() {
    // Load all namespaces from core
    const entries = ScanApp.findFiles('.yml', x => /config\/[^/]+.yml$/.test(x));

    for (const { file } of entries) {
      this.processConfig(file);
    }
  }

  private static processProfiles() {
    // Handle profile loads
    if (Env.profiles.length) {
      const envFiles = ResourceManager.findAllByExtensionSync('.yml')
        .map(file => ({ file, profile: path.basename(file).replace('.yml', '') }))
        .filter(({ profile }) => Env.hasProfile(profile))
        .map(({ file, profile }) => {
          const data = ResourceManager.readSync(file).toString();
          return { name: profile, data };
        });

      console.debug('Found configurations for', envFiles.map(x => x.name));

      for (const file of envFiles) {
        const data = YamlUtil.parse(file.data);
        this.map.putAll(data);
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
    const ns = path.basename(file).replace('.yml', '');
    const doc = YamlUtil.parse(data);
    this.map.putAll({ [ns]: doc });
  }

  /*
    Order of specificity (least to most)
      - Module configs -> located in the node_modules/@travetto/<*>/config folder
      - Local configs -> located in the config folder
      - External config file -> loaded from env
      - Environment vars -> Overrides everything (happens at bind time)
  */
  static initialize() {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.reloadConfig();

    if (!Env.quietInit) {
      console.info('Configured', this.map.toJSON());
    }
  }

  static reloadConfig() {
    this.map.reset();
    this.processConfigs();
    this.processProfiles();
  }
}