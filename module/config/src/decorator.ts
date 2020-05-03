import { ConfigManager } from './manager';

/**
 * Indicates that the given class should be populated with the configured fields, on instantiation
 *
 * @augments trv/config/Config
 * @augments trv/di/Injectable
 */
export function Config(ns: string, depTarget?: new (...args: any[]) => any, name: string = '') {

  return (target: new (...args: any[]) => any) => {
    const og = target.prototype.postConstruct;

    target.prototype.postConstruct = function () {
      // Apply config
      ConfigManager.bindTo(this, ns);
      if (og) {
        return og.call(this);
      }
    };
    return target;
  };
}