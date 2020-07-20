import { fromIni } from '@aws-sdk/credential-provider-ini';
import * as S3 from '@aws-sdk/client-s3';
import { EnvUtil } from '@travetto/boot';
import { Config } from '@travetto/config';

/**
 * S3 Support as an Asset Source
 */
@Config('s3.asset')
export class S3AssetConfig {
  region = 'us-east-1'; // AWS Region
  namespace = ''; // S3 Bucket folder
  bucket = ''; // S3 bucket

  accessKeyId = EnvUtil.get('AWS_ACCESS_KEY_ID') ?? '';
  secretAccessKey = EnvUtil.get('AWS_SECRET_ACCESS_KEY') ?? '';
  config: S3.S3ClientConfig; // Additional s3 config

  chunkSize = 5 * 2 ** 20; // Chunk size in bytes

  /**
   * Produces the s3 config from the provide details, post construction
   */
  async postConstruct() {
    if (!this.accessKeyId && !this.secretAccessKey) {
      const creds = await fromIni({ profile: EnvUtil.get('AWS_PROFILE') })();
      this.accessKeyId = creds.accessKeyId;
      this.secretAccessKey = creds.secretAccessKey;
    }

    this.config = {
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey
      }
    };
  }
}