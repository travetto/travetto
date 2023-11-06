import type mongo from 'mongodb';

import { FileResourceProvider, GlobalEnv, TimeSpan } from '@travetto/base';
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
  srvRecord = false;

  /**
   * Mongo client options
   */
  @Field(Object)
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
   * Load all the ssl certs as needed
   */
  async postConstruct(): Promise<void> {
    const resources = new FileResourceProvider({ includeCommon: true });
    const resolve = (file: string): Promise<string> => resources.resolve(file).then(path => path, () => file);

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

    const opts = this.options;
    if (opts.ssl) {
      if (opts.cert) {
        opts.cert = await Promise.all([opts.cert].flat(2).map(f => Buffer.isBuffer(f) ? f : resolve(f)));
      }
      if (opts.tlsCertificateKeyFile) {
        opts.tlsCertificateKeyFile = await resolve(opts.tlsCertificateKeyFile);
      }
      if (opts.tlsCAFile) {
        opts.tlsCAFile = await resolve(opts.tlsCAFile);
      }
      if (opts.tlsCRLFile) {
        opts.tlsCRLFile = await resolve(opts.tlsCRLFile);
      }
    }

    if (GlobalEnv.devMode) {
      opts.waitQueueTimeoutMS ??= 1000 * 60 * 60 * 24; // Wait a day in dev mode
    }
  }

  /**
   * Build connection URLs
   */
  get url(): string {
    const hosts = this.hosts!
      .map(h => (this.srvRecord || h.includes(':')) ? h : `${h}:${this.port ?? 27017}`)
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