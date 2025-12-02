import type mongo from 'mongodb';

import { TimeSpan, TimeUtil, RuntimeResources, Runtime } from '@travetto/runtime';
import { Config } from '@travetto/config';

/**
 * Mongo model config
 */
@Config('model.mongo')
export class MongoModelConfig {
  /**
   * Hosts
   */
  hosts?: string[];
  /**
   * Collection prefix
   */
  namespace?: string;
  /**
   * Username
   */
  username?: string;
  /**
   * Password
   */
  password?: string;
  /**
   * Server port
   */
  port?: number;
  /**
   * Direct mongo connection options
   */
  connectionOptions = {};
  /**
   * Is using the SRV DNS record configuration
   */
  srvRecord?: boolean;

  /**
   * Mongo client options
   */
  options: mongo.MongoClientOptions = {};

  /**
   * Should we auto create the db
   */
  autoCreate?: boolean;

  /**
   * Frequency of culling for cullable content
   */
  cullRate?: number | TimeSpan;

  /**
   * Connection string
   */
  connectionString?: string;

  /**
   * Should we store the _id as a string in the id field
   */
  storeId?: boolean;

  /**
   * Load all the ssl certs as needed
   */
  async postConstruct(): Promise<void> {
    const resolve = (file: string): Promise<string> => RuntimeResources.resolve(file).then(v => v, () => file);

    if (this.connectionString) {
      const details = new URL(this.connectionString);
      this.hosts ??= details.hostname.split(',').filter(x => !!x);
      this.srvRecord ??= details.protocol === 'mongodb+srv:';
      this.namespace ??= details.pathname.replace('/', '');
      Object.assign(this.options, Object.fromEntries(details.searchParams.entries()));
      this.port ??= +details.port;
      this.username ??= details.username;
      this.password ??= details.password;
    }

    // Defaults
    if (!this.namespace) {
      this.namespace = 'app';
    }
    if (!this.port || Number.isNaN(this.port)) {
      this.port = 27017;
    }
    if (!this.hosts || !this.hosts.length) {
      this.hosts = ['localhost'];
    }

    const options = this.options;
    if (options.ssl) {
      if (options.cert) {
        options.cert = await Promise.all([options.cert].flat(2).map(f => Buffer.isBuffer(f) ? f : resolve(f)));
      }
      if (options.tlsCertificateKeyFile) {
        options.tlsCertificateKeyFile = await resolve(options.tlsCertificateKeyFile);
      }
      if (options.tlsCAFile) {
        options.tlsCAFile = await resolve(options.tlsCAFile);
      }
      if (options.tlsCRLFile) {
        options.tlsCRLFile = await resolve(options.tlsCRLFile);
      }
    }

    if (!Runtime.production) {
      options.waitQueueTimeoutMS ??= TimeUtil.asMillis(1, 'd'); // Wait a day in dev mode
    }
  }

  /**
   * Build connection URLs
   */
  get url(): string {
    const hosts = this.hosts!
      .map(h => (this.srvRecord || h.includes(':')) ? h : `${h}:${this.port ?? 27017}`)
      .join(',');
    const optionString = Object.entries(this.options).map(([k, v]) => `${k}=${v}`).join('&');
    let creds = '';
    if (this.username) {
      creds = `${[this.username, this.password].filter(x => !!x).join(':')}@`;
    }
    const url = `mongodb${this.srvRecord ? '+srv' : ''}://${creds}${hosts}/${this.namespace}?${optionString}`;
    return url;
  }
}