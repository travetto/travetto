import { ConfigSource } from './source';

/**
 * @alias trv/config/Config
 * @alias trv/di/Injectable
 */
export function Config(ns: string, depTarget?: new (...args: any[]) => any, name: string = '') {

  return (target: new (...args: any[]) => any) => {
    const og = target.prototype.postConstruct;

    target.prototype.postConstruct = function () {
      // Apply config
      ConfigSource.bindTo(this, ns); // eslint-disable-line no-invalid-this
      if (og) {
        return og.apply(this, arguments); // eslint-disable-line no-invalid-this, prefer-rest-params
      }
    };
    return target;
  };
}