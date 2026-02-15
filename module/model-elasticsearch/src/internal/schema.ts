import type * as estypes from '@elastic/elasticsearch/api/types';

import { castTo, type Class, toConcrete } from '@travetto/runtime';
import { type Point, DataUtil, SchemaRegistryIndex } from '@travetto/schema';

import type { EsSchemaConfig } from './types.ts';

const PointConcrete = toConcrete<Point>();

const isMappingType = (input: estypes.MappingProperty): input is estypes.MappingTypeMapping =>
  (input.type === 'object' || input.type === 'nested') && 'properties' in input && !!input.properties;

/**
 * Utils for ES Schema management
 */
export class ElasticsearchSchemaUtil {

  /**
   * Build the update script for a given object
   */
  static generateUpdateScript(item: Record<string, unknown>): estypes.Script {
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
      params: { body: item },
    };
    return out;
  }

  /**
   * Generate replace script
   * @param item
   * @returns
   */
  static generateReplaceScript(item: Record<string, unknown>): estypes.Script {
    return {
      lang: 'painless',
      source: 'ctx._source.clear(); ctx._source.putAll(params.body)',
      params: { body: item }
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
    return allTypes.reduce<estypes.MappingTypeMapping>((mapping, schemaCls) => {
      DataUtil.deepAssign(mapping, this.generateSingleMapping(schemaCls, config));
      return mapping;
    }, { properties: {}, dynamic: false });
  }

  /**
   * Build a mapping for a given class
   */
  static generateSingleMapping<T>(cls: Class<T>, esSchema?: EsSchemaConfig): estypes.MappingTypeMapping {
    const fields = SchemaRegistryIndex.get(cls).getFields();

    const properties: Record<string, estypes.MappingProperty> = {};

    for (const [field, config] of Object.entries(fields)) {
      if (config.type === PointConcrete) {
        properties[field] = { type: 'geo_point' };
      } else if (config.type === castTo(BigInt)) {
        properties[field] = { type: 'long' };
      } else if (config.type === Number) {
        let property: Record<string, unknown> = { type: 'integer' };
        if (config.precision) {
          const [digits, decimals] = config.precision;
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
      } else if (config.type === Date) {
        properties[field] = { type: 'date', format: 'date_optional_time' };
      } else if (config.type === Boolean) {
        properties[field] = { type: 'boolean' };
      } else if (config.type === String) {
        let text = {};
        if (config.specifiers?.includes('text')) {
          text = {
            fields: {
              text: { type: 'text' }
            }
          };
          if (esSchema && esSchema.caseSensitive) {
            DataUtil.deepAssign(text, {
              fields: {
                ['text_cs']: { type: 'text', analyzer: 'whitespace' }
              }
            });
          }
        }
        properties[field] = { type: 'keyword', ...text };
      } else if (config.type === Object) {
        properties[field] = { type: 'object', dynamic: true };
      } else if (SchemaRegistryIndex.has(config.type)) {
        properties[field] = {
          type: config.array ? 'nested' : 'object',
          ...this.generateSingleMapping(config.type, esSchema)
        };
      }
    }

    return { properties, dynamic: false };
  }

  /**
   * Gets list of all changed fields between two mappings
   */
  static getChangedFields(current: estypes.MappingTypeMapping, needed: estypes.MappingTypeMapping, prefix = ''): string[] {
    const currentProperties = (current.properties ?? {});
    const neededProperties = (needed.properties ?? {});
    const allKeys = new Set([...Object.keys(currentProperties), ...Object.keys(neededProperties)]);
    const changed: string[] = [];

    for (const key of allKeys) {
      const path = prefix ? `${prefix}.${key}` : key;
      const currentProperty = currentProperties[key];
      const neededProperty = neededProperties[key];

      if (!currentProperty || !neededProperty || currentProperty.type !== neededProperty.type) {
        changed.push(path);
      } else if (isMappingType(currentProperty) || isMappingType(neededProperty)) {
        changed.push(...this.getChangedFields(
          'properties' in currentProperty ? currentProperty : { properties: {} },
          'properties' in neededProperty ? neededProperty : { properties: {} },
          path
        ));
      }
    }
    return changed;
  }
}