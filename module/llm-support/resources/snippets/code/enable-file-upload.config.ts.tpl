import { Config } from '@travetto/config';

@Config('upload')
export class UploadConfig {
  maxSize = 10_000_000;
}
