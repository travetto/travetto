import type s3 from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-provider-ini';

import { Config, EnvVar } from '@travetto/config';
import { PostConstruct } from '@travetto/di';
import { Runtime } from '@travetto/runtime';
import { Required, Url } from '@travetto/schema';

/**
 * S3 Support as an Asset Source
 */
@Config('model.s3')
export class S3ModelConfig {
  region = 'us-east-1'; // AWS Region
  namespace = ''; // S3 Bucket folder
  @Required(false)
  bucket: string; // S3 bucket
  @Required(false)
  endpoint?: string; // Endpoint url
  @Required(false)
  forcePathStyle?: boolean; // Use path-style URLs

  @EnvVar('AWS_ACCESS_KEY_ID')
  accessKeyId: string = '';
  @EnvVar('AWS_SECRET_ACCESS_KEY')
  secretAccessKey: string = '';
  @EnvVar('AWS_PROFILE')
  profile?: string;

  @Required(false)
  config: s3.S3ClientConfig; // Additional s3 config

  chunkSize = 5 * 2 ** 20; // Chunk size in bytes

  modifyStorage?: boolean;

  /**
   * Provide base URL for public access
   */
  @Url()
  @Required(false)
  publicBaseUrl: string;

  /**
   * Produces the s3 config from the provided details, post construction
   */
  @PostConstruct()
  async finalizeConfig(): Promise<void> {
    if (!Runtime.production) {
      this.endpoint ??= 'http://localhost:4566'; // From docker
      this.bucket ??= 'app';
    }

    if (!this.endpoint) {
      this.endpoint = undefined;
    }

    this.forcePathStyle ??= Boolean(this.endpoint);

    if (this.publicBaseUrl) {
      this.publicBaseUrl = this.publicBaseUrl.replace(/\/+$/, '');
    } else if (this.forcePathStyle && this.endpoint) {
      this.publicBaseUrl = `${this.endpoint.replace(/\/+$/, '')}/${this.bucket}`;
    } else {
      this.publicBaseUrl = `https://${this.bucket}.s3.amazonaws.com`;
    }

    if (!this.accessKeyId && !this.secretAccessKey) {
      try {
        const credentials = await fromIni({ profile: this.profile })();
        this.accessKeyId = credentials.accessKeyId;
        this.secretAccessKey = credentials.secretAccessKey;
      } catch {
        if (!Runtime.production) {
          this.accessKeyId = 'dummy';
          this.secretAccessKey = 'dummy';
        }
      }
    }

    this.config = {
      ...(this.config ?? {}),
      region: this.region,
      endpoint: this.endpoint,
      forcePathStyle: this.forcePathStyle,
      ...(this.accessKeyId && this.secretAccessKey
        ? {
            credentials: {
              accessKeyId: this.accessKeyId,
              secretAccessKey: this.secretAccessKey
            }
          }
        : {})
    };
  }
}
