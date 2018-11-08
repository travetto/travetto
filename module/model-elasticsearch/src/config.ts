import { Config } from '@travetto/config';

@Config('model.elasticsearch')
export class ModelElasticsearchConfig {
  hosts = ['127.0.0.1'];
  port = 9200;
  options = {};
  namespace = 'app';
  indexCreate = {
    number_of_replicas: 0,
    number_of_shards: 1
  };

  postConstruct() {
    console.debug('Constructed', this);
    this.hosts = this.hosts
      .map(x => x.includes(':') ? x : `${x}:${this.port}`)
      .map(x => x.startsWith('http') ? x : `http://${x}`) as any;
  }
}