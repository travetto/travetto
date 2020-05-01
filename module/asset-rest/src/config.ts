import { Config } from '@travetto/config';

/**
 * Config for assets within @travetto/rest
 */
@Config('rest.asset')
export class RestAssetConfig {
  maxSize = 10 * 1024 * 1024; // Max file size in bytes
  allowedTypes: string = ''; // Comma separated list of types to allow
  excludedTypes: string = ''; // Comma separated list of types to exclude

  allowedTypesList: string[];
  excludedTypesList: string[];

  postConstruct() {
    this.allowedTypesList = typeof this.allowedTypes === 'string' ?
      this.allowedTypes.trim().split(/\s*,\s*/).filter(x => !!x) : this.allowedTypes;
    this.excludedTypesList = typeof this.excludedTypes === 'string' ?
      this.excludedTypes.trim().split(/\s*,\s*/).filter(x => !!x) : this.excludedTypes;
  }
}