travetto: Rest-Aws-Lambda
===

**Install: AWS Provider**
```bash
$ npm install @travetto/rest-aws-lambda
```

The module is an [`aws-serverless-express`](https://github.com/awslabs/aws-serverless-express/blob/master/README.md) provider for the [`Rest`](https://github.com/travetto/travetto/tree/master/module/rest) module.

## Default Stack
When working with an [`express`](https://expressjs.com) applications, the module provides what is assumed to be a sufficient set of basic filters. Specifically:
* ```compression()```
* ```bodyParser.json()```
* ```bodyParser.urlencoded()```
* ```bodyParser.raw({ type: 'image/*' })```