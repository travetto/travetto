import { FeatureResult, GrowthBook, setPolyfills } from '@growthbook/growthbook';

import { Config } from '@travetto/config';
import { Injectable, Inject } from '@travetto/di';
import { AsyncContext } from '@travetto/context';
import { AuthContextService } from '@travetto/auth';
import { castTo, Class, Runtime } from '@travetto/runtime';
import { SchemaValidator } from '@travetto/schema';

@Config('growthbook')
export class GrowthBookConfig {
  clientKey: string;
  apiHost = 'https://cdn.growthbook.io';
}

type FeatureAttributes = Record<string, string | string[] | number | boolean | undefined>;

const FEATURE_FLAG_USER = Symbol.for('@growthbook/features');

@Injectable()
export class FeatureFlagService {

  @Inject()
  config: GrowthBookConfig;

  @Inject()
  context: AsyncContext;

  @Inject()
  auth: AuthContextService;

  #gb: Promise<GrowthBook | undefined>;

  async #init(): Promise<GrowthBook | undefined> {
    setPolyfills({
      EventSource: (await import('eventsource')).default
    });

    const gb = new GrowthBook({
      apiHost: this.config.apiHost,
      enableDevMode: !Runtime.production,
      clientKey: this.config.clientKey,
      subscribeToChanges: true
    });

    try {
      await gb.loadFeatures({ timeout: 5000 });
      return gb;
    } catch {
      return;
    }
  }

  async getAuthAttributes(): Promise<FeatureAttributes> {
    const p = this.auth.getPrincipal();

    if (!p) {
      console.debug('User not found, defaulting to environment-level attributes');
      return {};
    }

    return castTo(p?.details) ?? {};
  }

  async init(): Promise<GrowthBook | undefined> {
    if (this.context.active && this.context.get(FEATURE_FLAG_USER)) {
      return this.context.get(FEATURE_FLAG_USER);
    }

    const gb = await (this.#gb ??= this.#init());
    const scoped = new GrowthBook({
      attributes: this.context.active ? await this.getAuthAttributes() : {},
      features: { ...gb?.['_ctx'].features }
    });

    if (this.context.active) {
      this.context.set(FEATURE_FLAG_USER, scoped);
    }
    return scoped;
  }

  async #getFeature<T>(key: string): Promise<FeatureResult<T | null> | undefined> {
    return (await this.init())?.evalFeature<T>(key);
  }

  async isOn(key: string): Promise<boolean> {
    const flag = await this.#getFeature<boolean>(key);
    return flag?.on ?? false;
  }

  async isOff(key: string): Promise<boolean> {
    const flag = await this.#getFeature<boolean>(key);
    return flag?.off ?? false;
  }

  async getValue<T = unknown>(key: string, defValue: T): Promise<T> {
    const flag = await this.#getFeature<T>(key);
    return flag?.value ?? defValue;
  }

  async getValidated<T>(cls: Class<T>, key: string, defValue: T): Promise<T> {
    try {
      const data = await this.getValue(key, defValue);
      const instance: T = cls.from(castTo(data));
      await SchemaValidator.validate(cls, instance);
      return instance;
    } catch {
      return cls.from(castTo(defValue));
    }
  }

  async getValidatedList<T>(cls: Class<T>, key: string, defValue: T[]): Promise<T[]> {
    const data = await this.getValue(key, defValue);

    if (!Array.isArray(data)) {
      return defValue.map(x => cls.from(castTo(x)));
    }

    try {
      const instances = data.map(x => cls.from(castTo(x)));
      await SchemaValidator.validateAll(cls, instances);
      return instances;
    } catch {
      return defValue.map(x => cls.from(castTo(x)));
    }
  }
}