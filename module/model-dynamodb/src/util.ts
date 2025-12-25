import type {
  AttributeDefinition, AttributeValue, GlobalSecondaryIndex, GlobalSecondaryIndexDescription,
  GlobalSecondaryIndexUpdate, KeySchemaElement
} from '@aws-sdk/client-dynamodb';

import type { Class } from '@travetto/runtime';
import { ModelCrudUtil, ModelExpiryUtil, ModelRegistryIndex, NotFoundError, type ModelType } from '@travetto/model';

/**
 * Configuration for DynamoDB indices
 */
type DynamoIndexConfig = {
  indices?: GlobalSecondaryIndex[];
  attributes: AttributeDefinition[];
};

/**
 * Utility class for DynamoDB operations and transformations.
 */
export class DynamoDBUtil {

  /**
   * Converts an index name to a simplified format by removing non-alphanumeric characters
   */
  static simpleName(idx: string): string {
    return idx.replace(/[^A-Za-z0-9]/g, '');
  }

  /**
   * Converts a JavaScript value to a DynamoDB AttributeValue format
   * @param value The value to convert (string, number, boolean, Date, null, or undefined)
   * @returns The DynamoDB AttributeValue representation
   */
  static toValue(value: string | number | boolean | Date | undefined | null): AttributeValue;
  static toValue(value: unknown): AttributeValue | undefined {
    if (value === undefined || value === null || value === '') {
      return { NULL: true };
    } else if (typeof value === 'string') {
      return { S: value };
    } else if (typeof value === 'number') {
      return { N: `${value}` };
    } else if (typeof value === 'boolean') {
      return { BOOL: value };
    } else if (value instanceof Date) {
      return { N: `${value.getTime()}` };
    }
  }

  /**
   * Computes the DynamoDB index configuration for a model class.
   * Generates global secondary indices and attribute definitions based on the model's index configuration.
   */
  static computeIndexConfig<T extends ModelType>(cls: Class<T>): DynamoIndexConfig {
    const config = ModelRegistryIndex.getConfig(cls);
    const attributes: AttributeDefinition[] = [];
    const indices: GlobalSecondaryIndex[] = [];

    for (const idx of config.indices ?? []) {
      const idxName = this.simpleName(idx.name);
      attributes.push({ AttributeName: `${idxName}__`, AttributeType: 'S' });

      const keys: KeySchemaElement[] = [{
        AttributeName: `${idxName}__`,
        KeyType: 'HASH'
      }];

      if (idx.type === 'sorted') {
        keys.push({
          AttributeName: `${idxName}_sort__`,
          KeyType: 'RANGE'
        });
        attributes.push({ AttributeName: `${idxName}_sort__`, AttributeType: 'N' });
      }

      indices.push({
        IndexName: idxName,
        // ProvisionedThroughput: '',
        Projection: {
          ProjectionType: 'INCLUDE',
          NonKeyAttributes: ['body', 'id']
        },
        KeySchema: keys
      });
    }

    return { indices: indices.length ? indices : undefined, attributes };
  }

  /**
   * Identifies attribute definitions that have changed between current and requested configurations.
   * Compares attribute names and types to determine additions, removals, or modifications.
   */
  static findChangedAttributes(current: AttributeDefinition[] | undefined, requested: AttributeDefinition[] | undefined): AttributeDefinition[] {
    const currentMap = Object.fromEntries((current ?? []).map(attr => [attr.AttributeName, attr]));
    const pendingMap = Object.fromEntries((requested ?? []).map(attr => [attr.AttributeName, attr]));

    const changed: AttributeDefinition[] = [];
    for (const attr of requested ?? []) {
      if (!attr.AttributeName || attr.AttributeName === 'id') {
        continue;
      }
      if (!currentMap[attr.AttributeName] || currentMap[attr.AttributeName].AttributeType !== attr.AttributeType) {
        changed.push(attr);
      }
    }

    for (const attr of current ?? []) {
      if (!attr.AttributeName || attr.AttributeName === 'id') {
        continue;
      }
      if (!pendingMap[attr.AttributeName]) {
        changed.push(attr);
      }
    }
    return changed;
  }

  /**
   * Identifies global secondary indices that have changed between current and requested configurations.
   * Generates update operations for creating new indices or deleting removed indices.
   */
  static findChangedGlobalIndexes(current: GlobalSecondaryIndexDescription[] | undefined, requested: GlobalSecondaryIndex[] | undefined): GlobalSecondaryIndexUpdate[] {
    const existingMap = Object.fromEntries((current ?? []).map(index => [index.IndexName, index]));
    const pendingMap = Object.fromEntries((requested ?? []).map(index => [index.IndexName, index]));

    const indexUpdates = requested?.flatMap(index => {
      const out: GlobalSecondaryIndexUpdate[] = [];
      if (index.IndexName) {
        if (!existingMap[index.IndexName]) {
          out.push({ Create: index });
        } else if (!pendingMap[index.IndexName]) {
          out.push({ Delete: index });
        }
      }
      return out;
    });
    return indexUpdates ?? [];
  }

  /**
   * Loads a document from the model store and validates its expiry status.
   * If the model has an expiry configuration and the document is expired, throws NotFoundError.
   */
  static async loadAndCheckExpiry<T extends ModelType>(cls: Class<T>, doc: string): Promise<T> {
    const item = await ModelCrudUtil.load(cls, doc);
    if (ModelRegistryIndex.getConfig(cls).expiresAt) {
      const expiry = ModelExpiryUtil.getExpiryState(cls, item);
      if (!expiry.expired) {
        return item;
      }
    } else {
      return item;
    }
    throw new NotFoundError(cls, item.id);
  }
}
