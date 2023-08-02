import { fromIni } from '@aws-sdk/credential-provider-ini';
import type s3 from '@aws-sdk/client-s3';

import { Config, EnvVar } from '@travetto/config';
import { Field, Required } from '@travetto/schema';
import { GlobalEnv } from '@travetto/base';

/**
 * S3 Support as an Asset Source
 */
@Config('model.s3')
export class S3ModelConfig {
  region = 'us-east-1'; // AWS Region
  namespace = ''; // S3 Bucket folder
  bucket = ''; // S3 bucket
  endpoint = ''; // Endpoint url

  @EnvVar('AWS_ACCESS_KEY_ID')
  accessKeyId: string = '';
  @EnvVar('AWS_SECRET_ACCESS_KEY')
  secretAccessKey: string = '';
  @EnvVar('AWS_PROFILE')
  profile?: string;

  @Field(Object)
  @Required(false)
  config: s3.S3ClientConfig; // Additional s3 config

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
      const creds = await fromIni({ profile: this.profile })();
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

    // We are in localhost and not in prod, turn on forcePathStyle
    if (GlobalEnv.devMode && this.endpoint.includes('localhost')) {
      this.config.forcePathStyle ??= true;
    }
  }
}