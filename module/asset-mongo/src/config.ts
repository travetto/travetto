import { Config } from '@travetto/config';

/**
 * Mongo configuration as asset source
 */
@Config('mongo.asset')
export class MongoAssetConfig {
  hosts: string = 'localhost';  // List of hosts, comma separated
  namespace = 'app'; // Database namespace
  port = 27017;
  options = {}; // connection options

  /**
   * Compute connection URL
   */
  get url() {
    const hosts = this.hosts.split(',').map(h => `${h}:${this.port}`).join(',');
    const opts = Object.entries(this.options).map(([k, v]) => `${k}=${v}`).join('&');
    return `mongodb://${hosts}/${this.namespace}?${opts}`;
  }
}