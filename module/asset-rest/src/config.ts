import { Config } from '@travetto/config';

@Config('rest.asset')
export class RestAssetConfig {
  maxSize = 10 * 1024 * 1024;
  allowedTypes = '';
  excludeTypes = '';
}