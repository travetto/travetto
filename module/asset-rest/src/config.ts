import { Config } from '@travetto/config';

@Config('rest.asset')
// TODO: Document
export class RestAssetConfig {
  maxSize = 10 * 1024 * 1024;
  allowedTypes = '';
  excludeTypes = '';
}