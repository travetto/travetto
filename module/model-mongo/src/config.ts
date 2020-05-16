import * as mongo from 'mongodb';
import * as fs from 'fs';
import * as util from 'util';

import { ResourceManager } from '@travetto/base';
import { Config } from '@travetto/config';

const exists = util.promisify(fs.exists);
const read = util.promisify(fs.readFile);

/**
 * Mongo model config
 */
@Config('mongo.model')
export class MongoModelConfig {
  /**
   * Hosts
   */
  hosts = ['localhost'];
  /**
   * Collection prefix
   */
  namespace = 'app';
  /**
   * Username
   */
  username = '';
  /**
   * Password
   */
  password = '';
  /**
   * Server port
   */
  port = 27017;
  /**
   * Direct mongo connection options
   */
  connectionOptions = {};
  /**
   * Mongo client options
   */
  clientOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true
  } as mongo.MongoClientOptions;

  /**
   * Load a resource
   */
  async fetch(val: string) {
    try {
      return (await exists(val)) ? read(val) : ResourceManager.read(val);
    } catch {
      return val;
    }
  }

  /**
   * Load all the ssl certs as needed
   */
  async postConstruct() {
    const opts = this.clientOptions;
    if (opts.ssl) {
      if (opts.sslCert) {
        opts.sslCert = await this.fetch(opts.sslCert as string);
      }
      if (opts.sslKey) {
        opts.sslKey = await this.fetch(opts.sslKey as string);
      }
      if (opts.sslCA) {
        opts.sslCA = await Promise.all(opts.sslCA.map(k => this.fetch(k as string)));
      }
      if (opts.sslCRL) {
        opts.sslCRL = await Promise.all(opts.sslCRL.map(k => this.fetch(k as string)));
      }
    }
  }

  /**
   * Build connection URLs
   */
  get url() {
    const hosts = this.hosts
      .map(h => h.includes(':') ? h : `${h}:${this.port}`)
      .join(',');
    const opts = Object.entries(this.connectionOptions).map(([k, v]) => `${k}=${v}`).join('&');
    console.debug(hosts);
    return `mongodb://${hosts}/${this.namespace}?${opts}`;
  }
}