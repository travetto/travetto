import { ConfigLoader } from '../service/config-loader';
import { Class, DEFAULT_INSTANCE } from '@encore/di';

export function Config(ns: string, depTarget?: Class<any>, name: string = DEFAULT_INSTANCE) {
  return (target: Class<any & { postConstruct?: () => any }>) => {
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