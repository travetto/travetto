// @file-if @aws-sdk/client-dynamodb
import * as dynamodb from '@aws-sdk/client-dynamodb';

import { EnvUtil } from '@travetto/boot';
import { ShutdownManager } from '@travetto/base';

import { CacheEntry } from '../types';
import { CacheSource } from '../source/core';
import { CacheSourceUtil } from '../source/util';

/**
 * A cache source backed by DynamoDB
 */
export class DynamodbCacheSource extends CacheSource {

  cl: dynamodb.DynamoDB;

  constructor(public config: dynamodb.DynamoDBClientConfig = {}, public table: string = 'cache') {
    super();
  }

  async postConstruct() {
    this.cl = new dynamodb.DynamoDB(this.config);
    const verify = (await this.cl.describeTable({ TableName: this.table }).catch(err => ({ Table: undefined })));

    if (!EnvUtil.isReadonly() && !verify.Table) {
      await this.cl.createTable({
        TableName: this.table,
        KeySchema: [{
          KeyType: 'HASH',
          AttributeName: 'key'
        }],
        BillingMode: 'PROVISIONED',
        ProvisionedThroughput: {
          ReadCapacityUnits: 100,
          WriteCapacityUnits: 100
        },
        AttributeDefinitions: [
          { AttributeName: 'key', AttributeType: 'S' }
        ],
      });
      await this.cl.updateTimeToLive({
        TableName: this.table,
        TimeToLiveSpecification: {
          AttributeName: 'expires',
          Enabled: true
        }
      });
    }

    ShutdownManager.onShutdown(__filename, () => this.cl.destroy());
  }

  async get(key: string): Promise<CacheEntry | undefined> {
    const res = await this.cl.getItem({
      TableName: this.table,
      Key: { key: { S: key } }
    });
    const val = res.Item;
    if (val && val.value.S) {
      const ret = CacheSourceUtil.readAsSafeJSON(val.value.S);
      return ret;
    }
  }

  async has(key: string): Promise<boolean> {
    return !!(await this.get(key));
  }

  async set(key: string, entry: CacheEntry): Promise<any> {
    if (entry.maxAge) {
      entry.expiresAt = entry.maxAge + Date.now();
    }

    const cloned = CacheSourceUtil.storeAsSafeJSON(entry);

    await this.cl.putItem({
      TableName: this.table,
      Item: {
        key: { S: key },
        value: { S: cloned }
      }
    });

    if (entry.expiresAt) {
      await this.touch(key, entry.expiresAt);
    }

    return CacheSourceUtil.readAsSafeJSON(cloned);
  }

  async delete(key: string): Promise<boolean> {
    const res = await this.cl.deleteItem({
      TableName: this.table,
      ReturnValues: 'ALL_OLD',
      Key: { key: { S: key } }
    });
    return !!res.Attributes;
  }

  async isExpired(key: string) {
    return !(await this.has(key));
  }

  async touch(key: string, expiresAt: number): Promise<boolean> {
    const res = await this.cl.updateItem({
      TableName: this.table,
      Key: { key: { S: key } },
      ReturnValues: 'ALL_OLD',
      AttributeUpdates: {
        expires: {
          Action: 'PUT',
          Value: {
            N: `${Math.trunc(expiresAt / 1000)}`
          }
        }
      }
    });
    return !!res.Attributes;
  }

  async clear() {
    for (const key of await this.keys()) {
      await this.delete(key);
    }
  }

  async keys() {
    const out: string[] = [];
    let key: string | undefined = '';
    while (key !== undefined) {
      const req: dynamodb.ScanCommandOutput = await this.cl.scan({
        TableName: this.table,
        AttributesToGet: ['key'],
        ...(key ? { ExclusiveStartKey: { key: { S: key } } } : {})
      });
      out.push(...(req.Items?.map(x => x.key.S!) || []));
      console.log(out.length, req.LastEvaluatedKey);
      key = req.LastEvaluatedKey?.key.S;
    }
    return out;
  }
}