import { EnvUtil } from '@travetto/boot';
import { Config } from '@travetto/config';
import { EsSchemaConfig } from './internal/types';

/**
 * Elasticsearch model config
 */
@Config('elasticsearch.model')
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
  autoCreate = !EnvUtil.isReadonly();
  /**
   * Base schema config for elasticsearch
   */
  schemaConfig: EsSchemaConfig = {
    caseSensitive: false
  };

  /**
   * Base index create settings
   */
  indexCreate = {
    ['number_of_replicas']: 0,
    ['number_of_shards']: 1
  };

  /**
   * Build final hosts
   */
  postConstruct() {
    console.debug('Constructed', this);
    this.hosts = this.hosts
      .map(x => x.includes(':') ? x : `${x}:${this.port}`)
      .map(x => x.startsWith('http') ? x : `http://${x}`);
  }
}