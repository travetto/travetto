import { PathUtil } from '@travetto/boot';
import { AllTypeMap } from './node-types';
import { Mod } from './nodes';

const MAPPING = {
  App: 'module/app',
  Asset: 'module/asset',
  AssetRest: 'module/asset-rest',
  Auth: 'module/auth',
  AuthModel: 'module/auth-model',
  AuthRest: 'module/auth-rest',
  Base: 'module/base',
  Boot: 'module/boot',
  Cache: 'module/cache',
  Cli: 'module/cli',
  Command: 'module/command',
  Compiler: 'module/compiler',
  Config: 'module/config',
  Context: 'module/context',
  Di: 'module/di',
  Doc: 'module/doc',
  Email: 'module/email',
  EmailTemplate: 'module/email-template',
  Image: 'module/image',
  Jwt: 'module/jwt',
  Log: 'module/log',
  Model: 'module/model',
  ModelDynamodb: 'module/model-dynamodb',
  ModelElasticsearch: 'module/model-elasticsearch',
  ModelFirestore: 'module/model-firestore',
  ModelMongo: 'module/model-mongo',
  ModelQuery: 'module/model-query',
  ModelRedis: 'module/model-redis',
  ModelS3: 'module/model-s3',
  ModelSql: 'module/model-sql',
  Openapi: 'module/openapi',
  Pack: 'module/pack',
  Registry: 'module/registry',
  Rest: 'module/rest',
  RestExpress: 'module/rest-express',
  RestFastify: 'module/rest-fastify',
  RestKoa: 'module/rest-koa',
  RestSession: 'module/rest-session',
  Schema: 'module/schema',
  Test: 'module/test',
  Transformer: 'module/transformer',
  Watch: 'module/watch',
  Worker: 'module/worker',
  Yaml: 'module/yaml',
  GeneratorApp: 'related/generator-app'
};

export const mod = new Proxy({}, {
  get(tgt, p: keyof typeof MAPPING) {
    return Mod(PathUtil.resolveUnix('../..', MAPPING[p]));
  }
}) as Record<keyof typeof MAPPING, AllTypeMap['Mod']>;