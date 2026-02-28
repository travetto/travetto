import { FeatureResult, GrowthBook, setPolyfills } from '@growthbook/growthbook';

import { Config } from '@travetto/config';
import { Injectable, Inject } from '@travetto/di';
import { AsyncContext, AsyncContextValue } from '@travetto/context';
import { AuthContext } from '@travetto/auth';
import { castTo, Class, Runtime } from '@travetto/runtime';
import { SchemaValidator } from '@travetto/schema';

@Config('growthbook')
export class GrowthBookConfig {
  clientKey: string;
  apiHost = 'https://cdn.growthbook.io';
  realtime = true;
}

const read = <K>(cls: Class, input: K): K => Array.isArray(input) ? input.map(x => cls.from(x)) : cls.from(castTo(input));

@Injectable()
export class FeatureFlagService {

  @Inject()
  config: GrowthBookConfig;

  @Inject()
  context: AsyncContext;

  @Inject()
  auth: AuthContext;

  #root: GrowthBook;

  #active = new AsyncContextValue<GrowthBook>(this, { failIfUnbound: { read: false, write: false } });

  async postConstruct(): Promise<void> {
    try {
      if (this.config.realtime) {
        setPolyfills({ EventSource: (await import('eventsource')).default });
      }
      this.#root = new GrowthBook({
        apiHost: this.config.apiHost,
        enableDevMode: !Runtime.production,
        clientKey: this.config.clientKey,
        subscribeToChanges: this.config.realtime
      });

      await this.#root.loadFeatures({ timeout: 5000 });
    } catch { }
  }

  async #init(): Promise<GrowthBook | undefined> {
    let scoped = this.#active.get();
    if (!scoped) {
      const attributes = this.auth.principal?.details;
      if (!attributes) {
        console.debug('User not found, defaulting to environment-level attributes');
      }
      scoped = new GrowthBook({
        attributes: attributes ?? {},
        features: { ...this.#root?.['_ctx'].features }
      });
      this.#active.set(scoped);
    }
    return scoped;
  }

  #feature<T>(key: string): Promise<FeatureResult<T | null> | undefined> {
    return this.#init().then(v => v?.evalFeature<T>(key));
  }

  on(key: string): Promise<boolean> {
    return this.#feature<boolean>(key).then(flag => flag.on ?? false);
  }

  off(key: string): Promise<boolean> {
    return this.#feature<boolean>(key).then(flag => flag.off ?? false);
  }

  get<T = unknown>(key: string, defValue: T): Promise<T> {
    return this.#feature<T>(key).then(flag => flag?.value ?? defValue);
  }

  async getBound<T>(cls: Class<T>, key: string, defValue: T[]): Promise<T[]>;
  async getBound<T>(cls: Class<T>, key: string, defValue: T): Promise<T>;
  async getBound<T>(cls: Class<T>, key: string, defValue: T | T[]): Promise<T | T[]> {
    const data: T | T[] = await this.get(key, defValue);

    if (Array.isArray(defValue) && !Array.isArray(data)) {
      return read(cls, defValue);
    }

    try {
      return await (!Array.isArray(data) ?
        SchemaValidator.validate(cls, read(cls, data)) :
        SchemaValidator.validateAll(cls, read(cls, data)));
    } catch {
      return read(cls, defValue);
    }
  }
}