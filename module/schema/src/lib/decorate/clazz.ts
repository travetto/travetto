import { SchemaCls, SchemaRegistry } from '../service';

export function Discriminate(key: string) {
  return (target: any) => {
    const parent = Object.getPrototypeOf(target) as SchemaCls<any>;
    const parentConfig = SchemaRegistry.getSchemaConfig(parent);
    SchemaRegistry.registerSchemaFacet(target, {
      name: parentConfig.name,
      discriminator: key
    });

    // Register parent
    let parentConf = SchemaRegistry.getSchemaConfig(parent);
    parentConf.discriminated = parentConf.discriminated || {};
    parentConf.discriminated[key] = target;

    return target;
  };
}