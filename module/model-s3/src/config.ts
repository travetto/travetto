import { fromIni } from '@aws-sdk/credential-provider-ini';
import * as S3 from '@aws-sdk/client-s3';

import { Env } from '@travetto/base';
import { Config } from '@travetto/config';
import { Field, Required } from '@travetto/schema';

/**
 * S3 Support as an Asset Source
 */
@Config('model.s3')
export class S3ModelConfig {
  region = 'us-east-1'; // AWS Region
  namespace = ''; // S3 Bucket folder
  bucket = ''; // S3 bucket
  endpoint = ''; // Endpoint url

  accessKeyId: string = Env.get('AWS_ACCESS_KEY_ID', '');
  secretAccessKey: string = Env.get('AWS_SECRET_ACCESS_KEY', '');

  @Field(Object)
  @Required(false)
  config: S3.S3ClientConfig; // Additional s3 config

  chunkSize = 5 * 2 ** 20; // Chunk size in bytes

  autoCreate?: boolean;

  /**
   * Provide host to bucket
   */
  get hostName(): string {
    return `${this.bucket}.s3.amazonaws.com`;
  }

  /**
   * Produces the s3 config from the provide details, post construction
   */
  async postConstruct(): Promise<void> {
    if (!this.accessKeyId && !this.secretAccessKey) {
      const creds = await fromIni({ profile: Env.get('AWS_PROFILE') })();
      this.accessKeyId = creds.accessKeyId;
      this.secretAccessKey = creds.secretAccessKey;
    }

    this.config = {
      ...(this.config ?? {}),
      region: this.region,
      endpoint: this.endpoint,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey
      }
    };
  }
}