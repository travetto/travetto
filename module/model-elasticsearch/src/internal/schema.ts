import { estypes } from '@elastic/elasticsearch';

import { Class, toConcrete } from '@travetto/runtime';
import { Point, DataUtil, SchemaRegistryIndex } from '@travetto/schema';

import { EsSchemaConfig } from './types.ts';

const PointImpl = toConcrete<Point>();

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
    return SchemaRegistryIndex.getConfig(cls).discriminatedBase ?
      this.generateAllMapping(cls, config) :
      this.generateSingleMapping(cls, config);
  }

  /**
   * Generate all mappings
   */
  static generateAllMapping(cls: Class, config?: EsSchemaConfig): estypes.MappingTypeMapping {
    const allTypes = SchemaRegistryIndex.getDiscriminatedClasses(cls);
    return allTypes.reduce<estypes.MappingTypeMapping>((acc, schemaCls) => {
      DataUtil.deepAssign(acc, this.generateSingleMapping(schemaCls, config));
      return acc;
    }, { properties: {}, dynamic: false });
  }

  /**
   * Build a mapping for a given class
   */
  static generateSingleMapping<T>(cls: Class<T>, config?: EsSchemaConfig): estypes.MappingTypeMapping {
    const fields = SchemaRegistryIndex.get(cls).getFields();

    const properties: Record<string, estypes.MappingProperty> = {};

    for (const [field, conf] of Object.entries(fields)) {
      if (conf.type === PointImpl) {
        properties[field] = { type: 'geo_point' };
      } else if (conf.type === Number) {
        let property: Record<string, unknown> = { type: 'integer' };
        if (conf.precision) {
          const [digits, decimals] = conf.precision;
          if (decimals) {
            if ((decimals + digits) < 16) {
              property = { type: 'scaled_float', ['scaling_factor']: decimals };
            } else {
              if (digits < 6 && decimals < 9) {
                property = { type: 'half_float' };
              } else if (digits > 20) {
                property = { type: 'double' };
              } else {
                property = { type: 'float' };
              }
            }
          } else if (digits) {
            if (digits <= 2) {
              property = { type: 'byte' };
            } else if (digits <= 4) {
              property = { type: 'short' };
            } else if (digits <= 9) {
              property = { type: 'integer' };
            } else {
              property = { type: 'long' };
            }
          }
        }
        properties[field] = property;
      } else if (conf.type === Date) {
        properties[field] = { type: 'date', format: 'date_optional_time' };
      } else if (conf.type === Boolean) {
        properties[field] = { type: 'boolean' };
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
        properties[field] = { type: 'keyword', ...text };
      } else if (conf.type === Object) {
        properties[field] = { type: 'object', dynamic: true };
      } else if (SchemaRegistryIndex.has(conf.type)) {
        properties[field] = {
          type: conf.array ? 'nested' : 'object',
          ...this.generateSingleMapping(conf.type, config)
        };
      }
    }

    return { properties, dynamic: false };
  }
}