import { ConfigLoader } from '../service/config-loader';

export function Config(ns: string, depTarget?: new (...args: any[]) => any, name: string = '') {
  return (target: new (...args: any[]) => any) => {
    let og = target.prototype.postConstruct;

    target.prototype.postConstruct = function () {
      // Apply config
      ConfigLoader.bindTo(this, ns);
      if (og) {
        return og.apply(this, arguments);
      }
    }
    return target;
  };
}