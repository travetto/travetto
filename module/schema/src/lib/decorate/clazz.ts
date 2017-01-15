import { Cls, SchemaRegistry } from '../service';

export function SubType(key: string) {
  return (target: any) => {
    const parent = Object.getPrototypeOf(target) as Cls<any>;
    const parentConfig = SchemaRegistry.getClassConfig(parent);
    SchemaRegistry.registerClassFacet(target, {
      parent: parentConfig.name,
      discriminator: key
    });

    // Register parent
    let parentConf = SchemaRegistry.getClassConfig(parent);
    parentConf.subtypes = parentConf.subtypes || {};
    parentConf.subtypes[key] = target;

    return target;
  };
}