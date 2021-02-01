import { Library } from './nodes';

// Common
export const Travetto = Library('Travetto', 'https://travetto.dev');
export const Typescript = Library('Typescript', 'https://typescriptlang.org');
export const Node = Library('Node', 'https://nodejs.org');
export const TravettoPlugin = Library('VSCode plugin', 'https://marketplace.visualstudio.com/items?itemName=arcsine.travetto-plugin');

// Download
export const NodeDownload = Library(`Node`, 'https://nodejs.org/en/download/current/');
export const MongoDownload = Library(`Mongodb`, 'https://docs.mongodb.com/manual/administration/install-community/');
export const VSCodeDownload = Library(`VSCode`, 'https://code.visualstudio.com/download');

// Data formats
export const YAML = Library('YAML', 'https://en.wikipedia.org/wiki/YAML');
export const JSON = Library('JSON', 'https://www.json.org');
export const Base64 = Library('Base64', 'https://en.wikipedia.org/wiki/Base64');
export const TAP = Library('TAP 13', 'https://testanything.org/tap-version-13-specification.html');
export const XUnit = Library('xUnit', 'https://en.wikipedia.org/wiki/XUnit');

// Info
export const DependencyInjection = Library(`Dependency injection`, 'https://en.wikipedia.org/wiki/Dependency_injection');
export const OpenAPI = Library('OpenAPI', 'https://github.com/OAI/OpenAPI-Specification');
export const JSDoc = Library(`JSDoc`, 'http://usejsdoc.org/about-getting-started.html');
export const CodeLens = Library('CodeLens',
  'https://code.visualstudio.com/api/language-extensions/programmatic-language-features#codelens-show-actionable-context-information-within-source-code');

// Node
export const ChildProcess = Library(`child_process`, 'https://nodejs.org/api/child_process.html');
export const AsyncHooks = Library('async_hooks', 'https://nodejs.org/api/async_hooks.html');
export const Http = Library(`http`, 'https://nodejs.org/api/http.html');
export const Https = Library(`https`, 'https://nodejs.org/api/https.html');
export const Console = Library('console', 'https://nodejs.org/api/console.html');
export const Assert = Library('assert', 'https://nodejs.org/api/assert.html');

// Utils
export const Lodash = Library('lodash', 'https://lodash.com');
export const NodeForge = Library('node-forge', 'https://www.npmjs.com/package/node-forge');
export const Docker = Library('docker', 'https://www.docker.com/community-edition');
export const Debug = Library(`debug`, 'https://www.npmjs.com/package/debug');
export const OpenAPIGenerator = Library('OpenAPI client generation tools', 'https://github.com/OpenAPITools/openapi-generator');
export const Gaze = Library(`gaze`, `https://github.com/shama/gaze`);
export const Chokidar = Library(`chokidar`, 'https://github.com/paulmillr/chokidar');
export const Faker = Library(`faker`, 'https://github.com/marak/Faker.js/');
export const Yeoman = Library(`yeoman`, 'http://yeoman.io');
export const Commander = Library('commander', 'https://www.npmjs.com/package/commander');
export const Curl = Library('curl', 'https://curl.haxx.se/');

// JWT
export const JWT = Library('JWT', 'https://jwt.io/');
export const NodeJWT = Library('node-jsonwebtoken', 'https://github.com/auth0/node-jsonwebtoken');

// Email
export const NodeMailer = Library(`nodemailer`, 'https://nodemailer.com/about/');
export const Inky = Library(`inky`, 'https://github.com/zurb/inky');
export const Sass = Library('sass', 'https://github.com/sass/dart-sass');
export const Mustache = Library(`mustache`, `https://github.com/janl/mustache.js/`);

// Image
export const ImageMagick = Library('ImageMagick', 'https://imagemagick.org/index.php');
export const PngQuant = Library('pngquant', 'https://pngquant.org/');
export const JpegOptim = Library('Jpegoptim', 'https://github.com/tjko/jpegoptim');

// Dbs
export const MongoDB = Library('mongodb', 'https://mongodb.com');
export const S3 = Library('s3', 'https://aws.amazon.com/documentation/s3/');
export const Redis = Library('redis', 'https://redis.io');
export const Memcached = Library('memcached', 'https://memcached.org');
export const Elasticsearch = Library('elasticsearch', 'https://elastic.co');
export const SQL = Library('SQL', 'https://en.wikipedia.org/wiki/SQL');
export const MySQL = Library('MySQL', 'https://www.mysql.com/');
export const Postgres = Library('Postgres', 'https://postgresql.org');
export const DynamoDB = Library('DynamoDB', 'https://aws.amazon.com/dynamodb/');
export const Firestore = Library('Firestore', 'https://firebase.google.com/docs/firestore');

// Rest
export const Express = Library(`express`, 'https://expressjs.com');
export const Passport = Library('passport', 'http://passportjs.org');
export const Busboy = Library('busboy', 'https://github.com/mscdex/busboy');
export const Cookies = Library(`cookies`, 'https://www.npmjs.com/package/cookies');
export const AwsServerlessExpress = Library(`aws-serverless-express`, 'https://github.com/awslabs/aws-serverless-express/blob/master/README.md');
export const AwsLambdaFastify = Library(`aws-lambda-fastify`, 'https://github.com/fastify/aws-lambda-fastify/blob/master/README.md');
export const Fastify = Library(`fastify`, 'https://www.fastify.io/');
export const Koa = Library(`koa`, 'https://koajs.com/');
