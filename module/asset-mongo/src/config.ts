import { Config } from '@travetto/config';

@Config('mongo.asset')
export class MongoAssetConfig {
  hosts = 'localhost';
  schema = 'app';
  port = 27017;
  options = {};

  get url() {
    const hosts = this.hosts.split(',').map(h => `${h}:${this.port}`).join(',');
    const opts = Object.entries(this.options).map(([k, v]) => `${k}=${v}`).join('&');
    return `mongodb://${hosts}/${this.schema}?${opts}`;
  }
}