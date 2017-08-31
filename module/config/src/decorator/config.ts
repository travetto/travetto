import { ConfigLoader } from '../service/config-loader';
import { Registry, Class } from '@encore/di';

export function Config(ns: string, name: string = ns) {
  return (target: Class<any & { postLoad?: () => any }>) => {
    let og = target.prototype.postLoad;

    Registry.register({
      name,
      class: target,
      target: Config
    });

    target.prototype.postLoad = function () {
      // Apply config
      ConfigLoader.bindTo(this, ns);
      og.apply(this, arguments);
    }
    return target;
  };
}

(Config as any).__id = `${__filename}/Config`;