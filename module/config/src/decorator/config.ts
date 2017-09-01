import { ConfigLoader } from '../service/config-loader';
import { DependencyRegistry, Class, DEFAULT_INSTANCE } from '@encore/di';

export function Config(ns: string, depTarget?: Class<any>, name: string = DEFAULT_INSTANCE) {
  return (target: Class<any & { postConstruct?: () => any }>) => {
    let og = target.prototype.postConstruct;

    DependencyRegistry.finalizeClass({
      name,
      class: target,
      target: depTarget || target
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