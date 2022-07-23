import { TimeSpan } from '@travetto/base';
import { Config } from '@travetto/config';
import { Field } from '@travetto/schema';

import { EsSchemaConfig } from './internal/types';

/**
 * Elasticsearch model config
 */
@Config('model.elasticsearch')
export class ElasticsearchModelConfig {
  /**
   * List of hosts to support
   */
  hosts = ['127.0.0.1'];
  /**
   * Port to listen on
   */
  port = 9200;
  /**
   * Raw elasticsearch options
   */
  options = {};
  /**
   * Index prefix
   */
  namespace = 'app';
  /**
   * Auto-create, disabled in prod by default
   */
  autoCreate?: boolean;
  /**
   * Base schema config for elasticsearch
   */
  @Field(Object)
  schemaConfig: EsSchemaConfig = {
    caseSensitive: false
  };

  /**
   * Base index create settings
   */
  @Field(Object)
  indexCreate = {
    ['number_of_replicas']: 0,
    ['number_of_shards']: 1
  };

  /**
   * Frequency of culling for cullable content
   */
  cullRate?: number | TimeSpan;

  /**
   * Build final hosts
   */
  postConstruct(): void {
    console.debug('Constructed', { config: this });
    this.hosts = this.hosts
      .map(x => x.includes(':') ? x : `${x}:${this.port}`)
      .map(x => x.startsWith('http') ? x : `http://${x}`);
  }
}