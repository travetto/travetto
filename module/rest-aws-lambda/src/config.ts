import { Config } from '@travetto/config';

@Config('rest.express')
export class AwsLambdaConfig {
  cookie = {
    secure: false
  };
  secret = 'secret';
  binaryMimeTypes: [
    'application/javascript',
    'application/json',
    'application/octet-stream',
    'application/xml',
    'font/eot',
    'font/opentype',
    'font/otf',
    'image/jpeg',
    'image/png',
    'image/svg+xml',
    'text/comma-separated-values',
    'text/css',
    'text/html',
    'text/javascript',
    'text/plain',
    'text/text',
    'text/xml'
  ];
}