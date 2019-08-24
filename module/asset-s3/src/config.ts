import * as aws from 'aws-sdk';
import { Config } from '@travetto/config';

@Config('s3.asset')
export class S3AssetConfig {
  region = 'us-east-1';
  namespace = '';

  accessKeyId = process.env.AWS_ACCESS_KEY_ID || '';
  secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '';

  bucket = '';

  config: aws.S3.ClientConfiguration;

  get hostName() {
    return `${this.bucket}.s3.amazonaws.com`;
  }

  postConstruct() {
    if (!this.accessKeyId && !this.secretAccessKey) {
      const creds = new aws.SharedIniFileCredentials({ profile: process.env.AWS_PROFILE });
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