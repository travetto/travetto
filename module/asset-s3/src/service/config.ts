import * as aws from 'aws-sdk';
import { Config } from '@travetto/config';

@Config('asset.s3')
export class AssetS3Config {
  region = 'us-east-1';
  base = '';

  accessKeyId = '';
  secretAccessKey = '';

  bucket = '';

  config: aws.S3.ClientConfiguration

  postConstruct() {
    this.config = {
      apiVersion: '2006-03-01',
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey
      },
      params: {
        Bucket: this.bucket
      }
    }
  }
}