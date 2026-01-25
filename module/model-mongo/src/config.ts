import type mongo from 'mongodb';

import { type TimeSpan, TimeUtil, Runtime, RuntimeResources, BinaryUtil } from '@travetto/runtime';
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
   * Direct mongo connection options, these do not go on the connection string
   */
  connectionOptions: mongo.MongoClientOptions = {};
  /**
   * Is using the SRV DNS record configuration
   */
  srvRecord?: boolean;
  /**
   * Mongo client options
   */
  options: mongo.MongoClientOptions = {};
  /**
   * Allow storage modification at runtime
   */
  modifyStorage?: boolean;
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
    if (this.connectionString) {
      const details = new URL(this.connectionString);
      this.hosts ??= details.hostname.split(',').filter(host => !!host);
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
        const items = [options.cert].flat(2);
        options.cert = await Promise.all(items.map(input =>
          BinaryUtil.isBinaryType(input) ? BinaryUtil.toBuffer(input) :
            RuntimeResources.resolve(input).catch(() => BinaryUtil.fromUTF8String(input))
        ));
      }
      if (options.tlsCertificateKeyFile) {
        options.tlsCertificateKeyFile = await RuntimeResources.resolve(options.tlsCertificateKeyFile);
      }
      if (options.tlsCAFile) {
        options.tlsCAFile = await RuntimeResources.resolve(options.tlsCAFile);
      }
      if (options.tlsCRLFile) {
        options.tlsCRLFile = await RuntimeResources.resolve(options.tlsCRLFile);
      }
    }

    if (!Runtime.production) {
      options.waitQueueTimeoutMS = 0;
      options.serverSelectionTimeoutMS = TimeUtil.asMillis(1, 's');
    }
  }

  /**
   * Build connection URLs
   */
  get url(): string {
    const hosts = this.hosts!
      .map(host => (this.srvRecord || host.includes(':')) ? host : `${host}:${this.port ?? 27017}`)
      .join(',');
    const optionString = new URLSearchParams(Object.entries(this.options)).toString();
    let creds = '';
    if (this.username) {
      creds = `${[this.username, this.password].filter(part => !!part).join(':')}@`;
    }
    const url = `mongodb${this.srvRecord ? '+srv' : ''}://${creds}${hosts}/${this.namespace}?${optionString}`;
    return url;
  }
}