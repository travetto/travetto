import { Config } from '@travetto/config';

@Config('model.elasticsearch')
export class ModelElasticsearchConfig {
  hosts = ['127.0.0.1'];
  port = 9200;
  options = {};
  namespace = 'app';

  postConstruct() {
    console.log('Constructed', this);
    this.hosts = this.hosts
      .map(x => x.includes(':') ? x : `${x}:${this.port}`)
      .map(x => x.startsWith('http') ? x : `http://${x}`) as any;
  }
}