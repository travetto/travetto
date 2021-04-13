import { AllTypeMap, node } from './nodes';

const MAPPING = {
  App: '@travetto/app',
  Asset: '@travetto/asset',
  AssetRest: '@travetto/asset-rest',
  Auth: '@travetto/auth',
  AuthModel: '@travetto/auth-model',
  AuthRest: '@travetto/auth-rest',
  Base: '@travetto/base',
  Boot: '@travetto/boot',
  Cache: '@travetto/cache',
  Cli: '@travetto/cli',
  Command: '@travetto/command',
  Compiler: '@travetto/compiler',
  Config: '@travetto/config',
  Context: '@travetto/context',
  Di: '@travetto/di',
  Doc: '@travetto/doc',
  Email: '@travetto/email',
  EmailTemplate: '@travetto/email-template',
  Image: '@travetto/image',
  Jwt: '@travetto/jwt',
  Log: '@travetto/log',
  Model: '@travetto/model',
  ModelDynamodb: '@travetto/model-dynamodb',
  ModelElasticsearch: '@travetto/model-elasticsearch',
  ModelFirestore: '@travetto/model-firestore',
  ModelMongo: '@travetto/model-mongo',
  ModelQuery: '@travetto/model-query',
  ModelRedis: '@travetto/model-redis',
  ModelS3: '@travetto/model-s3',
  ModelSql: '@travetto/model-sql',
  Openapi: '@travetto/openapi',
  Pack: '@travetto/pack',
  Registry: '@travetto/registry',
  Rest: '@travetto/rest',
  RestExpress: '@travetto/rest-express',
  RestFastify: '@travetto/rest-fastify',
  RestKoa: '@travetto/rest-koa',
  RestSession: '@travetto/rest-session',
  Scaffold: '@travetto/scaffold',
  Schema: '@travetto/schema',
  Test: '@travetto/test',
  Transformer: '@travetto/transformer',
  Watch: '@travetto/watch',
  Worker: '@travetto/worker',
  Yaml: '@travetto/yaml'
};

export const mod = new Proxy({}, {
  get(tgt, p: keyof typeof MAPPING) {
    return node.Mod(MAPPING[p]);
  }
}) as Record<keyof typeof MAPPING, AllTypeMap['Mod']>;