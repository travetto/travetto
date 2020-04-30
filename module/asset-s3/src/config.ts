import * as aws from 'aws-sdk';
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

  config: aws.S3.ClientConfiguration; // Additional s3 config

  get hostName() {
    return `${this.bucket}.s3.amazonaws.com`;
  }

  /**
   * Produces the s3 config from the provide details, post construction
   */
  postConstruct() {
    if (!this.accessKeyId && !this.secretAccessKey) {
      const creds = new aws.SharedIniFileCredentials({ profile: EnvUtil.get('AWS_PROFILE') });
      this.accessKeyId = creds.accessKeyId;
      this.secretAccessKey = creds.secretAccessKey;
    }

    this.config = {
      apiVersion: '2006-03-01',
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey
      },
      params: {
        Bucket: this.bucket
      }
    };
  }
}