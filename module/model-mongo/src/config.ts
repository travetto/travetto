import * as mongo from 'mongodb';
import { promises as fs } from 'fs';

import { FsUtil } from '@travetto/boot';
import { ResourceManager } from '@travetto/base';
import { Config } from '@travetto/config';

/**
 * Mongo model config
 */
@Config('model.mongo')
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
   * Is using the SRV DNS record configuration
   */
  srvRecord = false;
  /**
   * Mongo client options
   */
  clientOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true
  } as mongo.MongoClientOptions;

  /**
   * Should we autocreate the db
   */
  autoCreate?: boolean;

  /**
   * Load a resource
   */
  async fetch(val: string) {
    try {
      return (await FsUtil.exists(val)) ? fs.readFile(val) : ResourceManager.read(val);
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
      .map(h => (this.srvRecord || h.includes(':')) ? h : `${h}:${this.port}`)
      .join(',');
    const opts = Object.entries(this.connectionOptions).map(([k, v]) => `${k}=${v}`).join('&');
    let creds;
    if (this.username) {
      creds = `${[this.username, this.password].filter(x => !!x).join(':')}@`;
    }
    return `mongodb${this.srvRecord ? '+srv' : ''}://${creds}${hosts}/${this.namespace}?${opts}`;
  }
}