import { AppInfo } from '@travetto/base/src/app-info';
import { ControllerConfig } from '@travetto/rest';

// TODO: Document
export function template(controllers: ControllerConfig[], lambdaDir?: string) {
  return `
AWSTemplateFormatVersion: '2010-09-09'
Transform: 'AWS::Serverless-2016-10-31'
Description: >-
  Travetto Application deployment for ${AppInfo.SIMPLE_NAME}
Resources:
${controllers.map(cont => `
  ${cont.class.name}:
    Type: 'AWS::Serverless::Function'
    Properties:
      Handler: index.handler
      Runtime: nodejs8.10
      CodeUri: ./lambda.zip
      Description: >-
        ${cont.description ?? ''}.
      MemorySize: 256
      Timeout: 60
      Events:
${cont.endpoints.map(ep => `
        ${ep.handlerName}:
          Type: 'Api'
          Properties:
            Path: ${(cont.basePath + ep.path).replace(/\/+/g, '/').replace(/:([A-Za-z0-9_]+)/g, (a, n) => `{${n}}`)}
            Method: ${ep.method.toUpperCase()}
`.replace(/^\n|\n$/g, '')).join('\n')}
`.replace(/^\n|\n$/g, '')).join('\n')}
`.trim();
}
