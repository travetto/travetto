import * as mongo from 'mongodb';
import * as fs from 'fs';
import * as util from 'util';

import { ResourceManager } from '@travetto/base';
import { Config } from '@travetto/config';

const exists = util.promisify(fs.exists);
const read = util.promisify(fs.readFile);

@Config('mongo.model')
export class MongoModelConfig {
  hosts = ['localhost'];
  namespace = 'app';
  username = '';
  password = '';
  port = 27017;
  connectionOptions = {} as any;
  clientOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true
  } as mongo.MongoClientOptions;

  async fetch(val: string) {
    try {
      return (await exists(val)) ? read(val) : ResourceManager.read(val);
    } catch {
      return val;
    }
  }

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

  get url() {
    const hosts = this.hosts
      .map(h => h.includes(':') ? h : `${h}:${this.port}`)
      .join(',');
    const opts = Object.entries(this.connectionOptions).map(([k, v]) => `${k}=${v}`).join('&');
    console.debug(hosts);
    return `mongodb://${hosts}/${this.namespace}?${opts}`;
  }
}