import { Cls, SchemaRegistry } from '../service';

export function Parent(key: string) {
  return (target: any) => {
    const parent = Object.getPrototypeOf(target) as Cls<any>;
    const parentConfig = SchemaRegistry.getSchemaConfig(parent);
    SchemaRegistry.registerSchemaFacet(target, {
      parent: parentConfig.name,
      discriminator: key
    });

    // Register parent
    let parentConf = SchemaRegistry.getSchemaConfig(parent);
    parentConf.subtypes = parentConf.subtypes || {};
    parentConf.subtypes[key] = target;

    return target;
  };
}