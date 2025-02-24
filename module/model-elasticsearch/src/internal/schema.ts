import { estypes } from '@elastic/elasticsearch';

import { Class } from '@travetto/runtime';
import { ModelRegistry } from '@travetto/model';
import { PointImpl } from '@travetto/model-query/src/internal/model/point.ts';
import { DataUtil, SchemaRegistry } from '@travetto/schema';

import { EsSchemaConfig } from './types.ts';

/**
 * Utils for ES Schema management
 */
export class ElasticsearchSchemaUtil {

  /**
   * Build the update script for a given object
   */
  static generateUpdateScript(o: Record<string, unknown>): estypes.Script {
    const out: estypes.Script = {
      lang: 'painless',
      source: `
 for (entry in params.body.entrySet()) {
  def key = entry.getKey();
  def value = entry.getValue();
  if (key ==~ /^_?id$/) {
    continue;
  }
  if (value == null) {
    ctx._source.remove(key);
  } else {
    ctx._source[key] = value;
  }
 }
`,
      params: { body: o },
    };
    return out;
  }

  /**
   * Generate replace script
   * @param o
   * @returns
   */
  static generateReplaceScript(o: Record<string, unknown>): estypes.Script {
    return {
      lang: 'painless',
      source: 'ctx._source.clear(); ctx._source.putAll(params.body)',
      params: { body: o }
    };
  }

  /**
   * Build one or more mappings depending on the polymorphic state
   */
  static generateSchemaMapping(cls: Class, config?: EsSchemaConfig): estypes.MappingTypeMapping {
    return ModelRegistry.get(cls).baseType ?
      this.generateAllMapping(cls, config) :
      this.generateSingleMapping(cls, config);
  }

  /**
   * Generate all mappings
   */
  static generateAllMapping(cls: Class, config?: EsSchemaConfig): estypes.MappingTypeMapping {
    const allTypes = ModelRegistry.getClassesByBaseType(cls);
    return allTypes.reduce<estypes.MappingTypeMapping>((acc, schemaCls) => {
      DataUtil.deepAssign(acc, this.generateSingleMapping(schemaCls, config));
      return acc;
    }, { properties: {}, dynamic: false });
  }

  /**
   * Build a mapping for a given class
   */
  static generateSingleMapping<T>(cls: Class<T>, config?: EsSchemaConfig): estypes.MappingTypeMapping {
    const schema = SchemaRegistry.getViewSchema(cls);

    const props: Record<string, estypes.MappingProperty> = {};

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
        if (conf.specifiers?.includes('text')) {
          text = {
            fields: {
              text: { type: 'text' }
            }
          };
          if (config && config.caseSensitive) {
            DataUtil.deepAssign(text, {
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
          ...this.generateSingleMapping(conf.type, config)
        };
      }
    }

    return { properties: props, dynamic: false };
  }
}