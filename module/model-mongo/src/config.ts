import { Config } from '@travetto/config';

@Config('mongo.model')
export class MongoModelConfig {
  hosts = 'localhost';
  namespace = 'app';
  port = 27017;
  options = {};

  get url() {
    const hosts = this.hosts.split(',').map(h => `${h}:${this.port}`).join(',');
    const opts = Object.entries(this.options).map(([k, v]) => `${k}=${v}`).join('&');
    return `mongodb://${hosts}/${this.namespace}?${opts}`;
  }
}