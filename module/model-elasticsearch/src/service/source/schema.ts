import { Class } from '@travetto/registry';
import { SchemaRegistry } from '@travetto/schema';

export function generateSourceSchema<T>(cls: Class<T>) {
  const schema = SchemaRegistry.getViewSchema(cls);

  const props: any = {};

  for (const field of schema.fields) {
    const conf = schema.schema[field];

    if (conf.type === Number) {
      props[field] = { type: conf.precision ? 'float' : 'integer' };
    } else if (conf.type === Date) {
      props[field] = { type: 'date' };
    } else if (conf.type === Boolean) {
      props[field] = { type: 'boolean' };
    } else if (conf.type === String) {
      props[field] = {
        type: 'text',
        fields: {
          raw: {
            type: 'keyword'
          }
        }
      };
    } else if (SchemaRegistry.has(conf.type)) {
      props[field] = {
        type: 'nested',
        ...generateSourceSchema(conf.type)
      };
    }
  }

  return { properties: props, dynamic: false };
}