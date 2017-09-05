import { Config } from '@encore/config';

@Config('upload')
export class AssetExpressConfig {
  maxSize = 10 * 1024 * 1024;
  allowedTypes = '';
  excludeTypes = '';
}