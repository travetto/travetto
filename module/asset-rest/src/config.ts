import { Config } from '@travetto/config';

@Config('rest.upload')
export class AssetRestConfig {
  maxSize = 10 * 1024 * 1024;
  allowedTypes = '';
  excludeTypes = '';
}