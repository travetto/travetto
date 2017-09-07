import { Config } from '@encore2/config';

@Config('mongo')
export class ModelMongoConfig {
  hosts = 'localhost';
  schema = 'app';
  port = 27017;
  options = {};

  get url() {
    let hosts = this.hosts.split(',').map(h => `${h}:${this.port}`).join(',');
    let opts = Object.entries(this.options).map(([k, v]) => `${k}=${v}`).join('&');
    return `mongodb://${hosts}/${this.schema}?${opts}`;
  }
}