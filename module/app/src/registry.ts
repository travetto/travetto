import { Env, AppInfo } from '@travetto/base';
import { ConfigSource } from '@travetto/config';
import { DependencyRegistry, InjectionError } from '@travetto/di';

import { ApplicationConfig } from './types';

export class $ApplicationRegistry {
  private applications = new Map<string, ApplicationConfig>();

  register(app: string, config: ApplicationConfig) {
    this.applications.set(app, config);
  }

  loadAllFromConfig() {
    for (const entries of Object.values(ConfigSource.get('app.entry') || {}) as string[][]) {
      for (const entry of entries) {
        require(entry);
      }
    }
  }

  getAll() {
    return Array.from(this.applications.values());
  }

  async run(name: string, args: any[]) {
    const config = this.applications.get(name);
    if (!config) {
      throw new InjectionError(`Application: ${name} does not exist`, 'notfound');
    }
    const inst = await DependencyRegistry.getInstance(config.target);
    if (!Env.quietInit) {
      console.log('Running application', name);
      console.log('Configured', JSON.stringify({
        app: AppInfo,
        env: Env.toJSON(),
        config: ConfigSource.get(''),
      }, undefined, 2));
    }
    if (inst.run) {
      await inst.run(...args);
    }
  }

  onReset() {
    this.applications.clear();
  }
}

export const ApplicationRegistry = new $ApplicationRegistry();