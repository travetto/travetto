import { version as VERSION } from '@elastic/elasticsearch/package.json';

import { Class, Util } from '@travetto/base';
import { ModelRegistry } from '@travetto/model';
import { PointImpl } from '@travetto/model-query/src/internal/model/point';
import { SchemaRegistry } from '@travetto/schema';

import { EsSchemaConfig } from './types';


type FieldType = {
  type?: string;
  format?: string;
  scaling_factor?: number;
  fields?: Record<string, FieldType>;
  dynamic?: boolean;
  properties?: Record<string, FieldType>;
};

type SchemaType = {
  properties: Record<string, FieldType>;
  dynamic: boolean;
};

/**
 * Utils for ES Schema management
 */
export class ElasticsearchSchemaUtil {

  static MAJOR_VER = parseInt(VERSION.split('.')[0], 10);

  /**
   * Build the update script for a given object
   */
  static generateUpdateScript(o: Record<string, unknown>, path: string = '', arr = false) {
    const ops: string[] = [];
    const out = {
      params: {} as Record<string, unknown>,
      lang: 'painless',
      source: ''
    };
    for (const x of Object.keys(o ?? {})) {
      if (!path && (x === '_id' || x === 'id')) {
        continue;
      }
      const prop = arr ? `${path}[${x}]` : `${path}${path ? '.' : ''}${x}`;
      if (o[x] === undefined || o[x] === null) {
        ops.push(`ctx._source.${path}${path ? '.' : ''}remove("${x}")`);
      } else if (Util.isPrimitive(o[x]) || Array.isArray(o[x])) {
        const param = prop.toLowerCase().replace(/[^a-z0-9_$]/g, '_');
        ops.push(`ctx._source.${prop} = params.${param}`);
        out.params[param] = o[x];
      } else {
        ops.push(`ctx._source.${prop} = ctx._source.${prop} == null ? [:] : ctx._source.${prop}`);
        const sub = this.generateUpdateScript(o[x] as Record<string, unknown>, prop);
        ops.push(sub.source);
        Object.assign(out.params, sub.params);
      }
    }
    out.source = ops.join(';');

    return out;
  }

  /**
   * Build one or more schemas depending on the polymorphic state
   */
  static generateSourceSchema(cls: Class, config?: EsSchemaConfig) {
    return ModelRegistry.get(cls).baseType ?
      this.generateAllSourceSchema(cls, config) :
      this.generateSingleSourceSchema(cls, config);
  }

  /**
   * Generate all schemas
   */
  static generateAllSourceSchema(cls: Class, config?: EsSchemaConfig) {
    const allTypes = ModelRegistry.getClassesByBaseType(cls);
    return allTypes.reduce((acc, scls) => {
      Util.deepAssign(acc, this.generateSingleSourceSchema(scls, config));
      return acc;
    }, {} as SchemaType);
  }

  /**
   * Build a schema for a given class
   */
  static generateSingleSourceSchema<T>(cls: Class<T>, config?: EsSchemaConfig): SchemaType {
    const schema = SchemaRegistry.getViewSchema(cls);

    const props: SchemaType['properties'] = {};

    for (const field of schema.fields) {
      const conf = schema.schema[field];

      if (conf.type === PointImpl) {
        props[field] = { type: 'geo_point' };
      } else if (conf.type === Number) {
        let prop: Record<string, unknown> = { type: 'integer' };
        if (conf.precision) {
          const [digits, decimals] = conf.precision;
          if (decimals) {
            if ((decimals + digits) < 16) {
              prop = { type: 'scaled_float', ['scaling_factor']: decimals };
            } else {
              if (digits < 6 && decimals < 9) {
                prop = { type: 'half_float' };
              } else if (digits > 20) {
                prop = { type: 'double' };
              } else {
                prop = { type: 'float' };
              }
            }
          } else if (digits) {
            if (digits <= 2) {
              prop = { type: 'byte' };
            } else if (digits <= 4) {
              prop = { type: 'short' };
            } else if (digits <= 9) {
              prop = { type: 'integer' };
            } else {
              prop = { type: 'long' };
            }
          }
        }
        props[field] = prop;
      } else if (conf.type === Date) {
        props[field] = { type: 'date', format: 'date_optional_time' };
      } else if (conf.type === Boolean) {
        props[field] = { type: 'boolean' };
      } else if (conf.type === String) {
        let text = {};
        if (conf.specifier && conf.specifier.startsWith('text')) {
          text = {
            fields: {
              text: { type: 'text' }
            }
          };
          if (config && config.caseSensitive) {
            Util.deepAssign(text, {
              fields: {
                ['text_cs']: { type: 'text', analyzer: 'whitespace' }
              }
            });
          }
        }
        props[field] = { type: 'keyword', ...text };
      } else if (conf.type === Object) {
        props[field] = { type: 'object', dynamic: true };
      } else if (SchemaRegistry.has(conf.type)) {
        props[field] = {
          type: conf.array ? 'nested' : 'object',
          ...this.generateSingleSourceSchema(conf.type, config)
        };
      }
    }

    return { properties: props, dynamic: false };
  }
}