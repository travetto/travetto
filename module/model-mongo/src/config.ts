import * as mongo from 'mongodb';

import { FileResourceProvider, TimeSpan } from '@travetto/base';
import { Config } from '@travetto/config';
import { Field } from '@travetto/schema';

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
  @Field(Object)
  options: mongo.MongoClientOptions = {
  };

  /**
   * Should we auto create the db
   */
  autoCreate?: boolean;

  /**
   * Frequency of culling for cullable content
   */
  cullRate?: number | TimeSpan;

  /**
   * Load all the ssl certs as needed
   */
  async postConstruct(): Promise<void> {
    const resources = new FileResourceProvider({ includeCommon: true });
    const resolve = (file: string): Promise<string> => resources.describe(file).then(({ path }) => path, () => file);

    const opts = this.options;
    if (opts.ssl) {
      if (opts.sslCert) {
        opts.tlsCertificateFile = await resolve(opts.sslCert);
      }
      if (opts.sslKey) {
        opts.sslKey = await resolve(opts.sslKey);
      }
      if (opts.sslCA) {
        opts.sslCA = await resolve(opts.sslCA);
      }
      if (opts.sslCRL) {
        opts.sslCRL = await resolve(opts.sslCRL);
      }
    }
  }

  /**
   * Build connection URLs
   */
  get url(): string {
    const hosts = this.hosts
      .map(h => (this.srvRecord || h.includes(':')) ? h : `${h}:${this.port}`)
      .join(',');
    const opts = Object.entries(this.options).map(([k, v]) => `${k}=${v}`).join('&');
    let creds = '';
    if (this.username) {
      creds = `${[this.username, this.password].filter(x => !!x).join(':')}@`;
    }
    const url = `mongodb${this.srvRecord ? '+srv' : ''}://${creds}${hosts}/${this.namespace}?${opts}`;
    return url;
  }
}