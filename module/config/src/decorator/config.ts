import { ConfigLoader } from '../service/loader';

export function Config(ns: string, depTarget?: new (...args: any[]) => any, name: string = '') {

  return (target: new (...args: any[]) => any) => {
    const og = target.prototype.postConstruct;

    target.prototype.postConstruct = function () {
      // Apply config
      ConfigLoader.bindTo(this, ns); // tslint:disable-line no-invalid-this
      if (og) {
        return og.apply(this, arguments); // tslint:disable-line no-invalid-this
      }
    }
    return target;
  };
}