import { node } from './nodes';

const { Library } = node;

// Common
export const lib = {
  Travetto: Library('Travetto', 'https://travetto.dev'),
  Typescript: Library('Typescript', 'https://typescriptlang.org'),
  Node: Library('Node', 'https://nodejs.org'),
  TravettoPlugin: Library('VSCode plugin', 'https://marketplace.visualstudio.com/items?itemName=arcsine.travetto-plugin'),

  // Download
  NodeDownload: Library('Node', 'https://nodejs.org/en/download/current/'),
  MongoDownload: Library('Mongodb', 'https://docs.mongodb.com/manual/administration/install-community/'),
  VSCodeDownload: Library('VSCode', 'https://code.visualstudio.com/download'),

  // Data formats
  YAML: Library('YAML', 'https://en.wikipedia.org/wiki/YAML'),
  JSON: Library('JSON', 'https://www.json.org'),
  Base64: Library('Base64', 'https://en.wikipedia.org/wiki/Base64'),
  TAP: Library('TAP 13', 'https://testanything.org/tap-version-13-specification.html'),
  XUnit: Library('xUnit', 'https://en.wikipedia.org/wiki/XUnit'),
  Markdown: Library('Markdown', 'https://en.wikipedia.org/wiki/Markdown'),
  HTML: Library('HTML', 'https://en.wikipedia.org/wiki/HTML'),

  // Info
  DependencyInjection: Library('Dependency injection', 'https://en.wikipedia.org/wiki/Dependency_injection'),
  OpenAPI: Library('OpenAPI', 'https://github.com/OAI/OpenAPI-Specification'),
  JSDoc: Library('JSDoc', 'http://usejsdoc.org/about-getting-started.html'),
  CodeLens: Library('CodeLens',
    'https://code.visualstudio.com/api/language-extensions/programmatic-language-features#codelens-show-actionable-context-information-within-source-code'),

  // Node
  ChildProcess: Library('child_process', 'https://nodejs.org/api/child_process.html'),
  AsyncHooks: Library('async_hooks', 'https://nodejs.org/api/async_hooks.html'),
  Http: Library('http', 'https://nodejs.org/api/http.html'),
  Https: Library('https', 'https://nodejs.org/api/https.html'),
  Console: Library('console', 'https://nodejs.org/api/console.html'),
  Assert: Library('assert', 'https://nodejs.org/api/assert.html'),

  // Cloud
  AwsCloudwatch: Library('AWS Cloudwatch', 'https://aws.amazon.com/cloudwatch/'),

  // Utils
  Lodash: Library('lodash', 'https://lodash.com'),
  NodeForge: Library('node-forge', 'https://www.npmjs.com/package/node-forge'),
  Docker: Library('docker', 'https://www.docker.com/community-edition'),
  Debug: Library('debug', 'https://www.npmjs.com/package/debug'),
  OpenAPIGenerator: Library('OpenAPI client generation tools', 'https://github.com/OpenAPITools/openapi-generator'),
  Gaze: Library('gaze', 'https://github.com/shama/gaze'),
  Chokidar: Library('chokidar', 'https://github.com/paulmillr/chokidar'),
  Faker: Library('faker', 'https://github.com/marak/Faker.js/'),
  Yeoman: Library('yeoman', 'http://yeoman.io'),
  Commander: Library('commander', 'https://www.npmjs.com/package/commander'),
  Curl: Library('curl', 'https://curl.haxx.se/'),
  Fetch: Library('fetch', 'https://www.npmjs.com/package/node-fetch'),

  // JWT
  JWT: Library('JWT', 'https://jwt.io/'),
  NodeJWT: Library('node-jsonwebtoken', 'https://github.com/auth0/node-jsonwebtoken'),

  // Email
  NodeMailer: Library('nodemailer', 'https://nodemailer.com/about/'),
  Inky: Library('inky', 'https://github.com/zurb/inky'),
  Sass: Library('sass', 'https://github.com/sass/dart-sass'),
  Mustache: Library('mustache', 'https://github.com/janl/mustache.js/'),

  // Image
  ImageMagick: Library('ImageMagick', 'https://imagemagick.org/index.php'),
  PngQuant: Library('pngquant', 'https://pngquant.org/'),
  JpegOptim: Library('Jpegoptim', 'https://github.com/tjko/jpegoptim'),

  // Dbs
  MongoDB: Library('mongodb', 'https://mongodb.com'),
  S3: Library('s3', 'https://aws.amazon.com/documentation/s3/'),
  Redis: Library('redis', 'https://redis.io'),
  Memcached: Library('memcached', 'https://memcached.org'),
  Elasticsearch: Library('elasticsearch', 'https://elastic.co'),
  SQL: Library('SQL', 'https://en.wikipedia.org/wiki/SQL'),
  MySQL: Library('MySQL', 'https://www.mysql.com/'),
  Postgres: Library('Postgres', 'https://postgresql.org'),
  DynamoDB: Library('DynamoDB', 'https://aws.amazon.com/dynamodb/'),
  Firestore: Library('Firestore', 'https://firebase.google.com/docs/firestore'),
  SQLite: Library('SQLite', 'https://www.sqlite.org/'),


  // Rest
  Express: Library('express', 'https://expressjs.com'),
  Passport: Library('passport', 'http://passportjs.org'),
  Busboy: Library('busboy', 'https://github.com/mscdex/busboy'),
  Cookies: Library('cookies', 'https://www.npmjs.com/package/cookies'),
  ServerlessExpress: Library('aws-serverless-express', 'https://github.com/awslabs/aws-serverless-express/blob/master/README.md'),
  AwsLambdaFastify: Library('@fastify/aws-lambda', 'https://github.com/fastify/aws-lambda-fastify/blob/master/README.md'),
  Fastify: Library('fastify', 'https://www.fastify.io/'),
  Koa: Library('koa', 'https://koajs.com/'),
};