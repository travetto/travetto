import { Class } from '@travetto/base';
import { ConfigManager } from './manager';

/**
 * Indicates that the given class should be populated with the configured fields, on instantiation
 * @augments `@trv:schema/Schema`
 * @augments `@trv:di/Injectable`
 */
export function Config(ns: string, params?: { internal?: boolean }) {
  return <T extends Class>(target: T) => {
    const og = target.prototype.postConstruct;

    target.prototype.postConstruct = async function () {
      // Apply config
      await ConfigManager.install(target, this, ns, params?.internal);
      if (og) {
        await og.call(this);
      }
    };
    return target;
  };
}