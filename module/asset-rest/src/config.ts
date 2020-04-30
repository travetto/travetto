import { Config } from '@travetto/config';

/**
 * Config for assets within @travetto/rest
 */
@Config('rest.asset')
export class RestAssetConfig {
  maxSize = 10 * 1024 * 1024; // Max file size in bytes
  allowedTypes = ''; // Comma separated list of allowed types
  excludeTypes = ''; // Comma separated list of excluded types
}