import { ConfigLoader } from '../service/config-loader';
import { Registry, Class } from '@encore/di';

export function Config(ns: string, depTarget?: Class<any>, name: string = ns) {
  return (target: Class<any & { postConstruct?: () => any }>) => {
    let og = target.prototype.postConstruct;

    Registry.register({
      name,
      class: target,
      target: depTarget || Config
    });

    target.prototype.postConstruct = function () {
      // Apply config
      ConfigLoader.bindTo(this, ns);
      if (og) {
        og.apply(this, arguments);
      }
    }
    return target;
  };
}

(Config as any).__id = `${__filename}/Config`;