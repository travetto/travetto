import { AllTypeMap, node } from './nodes';

const MAPPING = {
  App: '@travetto/app',
  Asset: '@travetto/asset',
  AssetRest: '@travetto/asset-rest',
  Auth: '@travetto/auth',
  AuthRest: '@travetto/auth-rest',
  AuthRestContext: '@travetto/auth-rest-context',
  AuthRestJwt: '@travetto/auth-rest-jwt',
  AuthRestSession: '@travetto/auth-rest-session',
  AuthRestPassport: '@travetto/auth-rest-passport',
  Base: '@travetto/base',
  Boot: '@travetto/boot',
  Cache: '@travetto/cache',
  Cli: '@travetto/cli',
  Command: '@travetto/command',
  Config: '@travetto/config',
  Context: '@travetto/context',
  Di: '@travetto/di',
  Doc: '@travetto/doc',
  Email: '@travetto/email',
  EmailNodemailer: '@travetto/email-nodemailer',
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
  ModelSQLite: '@travetto/model-sqlite',
  ModelPostgres: '@travetto/model-postgres',
  ModelMysql: '@travetto/model-mysql',
  ModelSql: '@travetto/model-sql',
  Openapi: '@travetto/openapi',
  Pack: '@travetto/pack',
  Registry: '@travetto/registry',
  Rest: '@travetto/rest',
  RestAwsLambda: '@travetto/rest-aws-lambda',
  RestExpress: '@travetto/rest-express',
  RestExpressLambda: '@travetto/rest-express-lambda',
  RestFastify: '@travetto/rest-fastify',
  RestFastifyLambda: '@travetto/rest-fastify-lambda',
  RestKoa: '@travetto/rest-koa',
  RestKoaLambda: '@travetto/rest-koa-lambda',
  RestModel: '@travetto/rest-model',
  RestModelQuery: '@travetto/rest-model-query',
  RestSession: '@travetto/rest-session',
  Scaffold: '@travetto/scaffold',
  Schema: '@travetto/schema',
  SchemaFaker: '@travetto/schema-faker',
  Test: '@travetto/test',
  Transformer: '@travetto/transformer',
  Watch: '@travetto/watch',
  Worker: '@travetto/worker',
  Yaml: '@travetto/yaml'
};

export const mod = new Proxy<Record<keyof typeof MAPPING, AllTypeMap['Mod']>>(
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  {} as Record<keyof typeof MAPPING, AllTypeMap['Mod']>,
  {
    get(tgt, p: keyof typeof MAPPING): AllTypeMap['Mod'] {
      return node.Mod(MAPPING[p]);
    }
  }
);