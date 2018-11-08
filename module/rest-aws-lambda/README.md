travetto: Rest-Aws-Lambda
===

**Install: AWS Provider**
```bash
$ npm install @travetto/rest-aws-lambda
```


The module is an [`aws-serverless-express`](https://github.com/awslabs/aws-serverless-express/blob/master/README.md) provider for the [`Rest`](https://github.com/travetto/travetto/tree/master/module/rest) module. A valid configuration of [`RestAppProvider`](./src/types.ts) would look like:

**Code: Wiring up AWS Lambda Provider**
```typescript
export class SampleConfig {
  @InjectableFactory()
  static getProvider(): RestAppProvider {
    return new RestAwsLambdaAppProvider();
  }
}
```

## Default Stack
When working with [`express`](https://expressjs.com) applications, the module provides what is assumed to be a sufficient set of basic filters. Specifically:
* ```compression()```
* ```cookieParser()```
* ```bodyParser.json()```
* ```bodyParser.urlencoded()```
* ```bodyParser.raw({ type: 'image/*' })```