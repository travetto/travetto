#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const child_process = require('child_process');
const app = require(`${process.cwd()}/package.json`);

const name = app.name.replace(/[^A-Za-z0-9]/g, '_');

const tempDir = path.join(os.tmpdir(), 'travetto-swagger');
const swaggerJar = path.join(tempDir, 'swagger.jar');
const swaggerJson = path.join(tempDir, `${name}.swagger.json`);
const version = process.env.TRV_VERSION || '2.3.1';

let [output, endpoint, format] = process.argv.slice(2);
output = output || process.env.TRV_OUTPUT || `${process.cwd()}/api-client`;
endpoint = endpoint || process.env.TRV_ENDPOINT || 'http://localhost:3000/swagger.json';
format = format || process.env.TRV_FORMAT || 'typescript-angular';

let lastHash = undefined;

async function download(url, out) {

  await new Promise((resolve, reject) => {
    http.get(url, function(response) {
      response.pipe(
        fs.createWriteStream(out).on('error', reject).on('close', resolve)
      );
    }).on('error', reject);
  });

  return new Promise((resolve, reject) => {
    fs.createReadStream(out)
      .pipe(crypto.createHash('sha1').setEncoding('hex'))
      .on('finish', function() {

        //eslint-disable-next-line no-invalid-this
        resolve(this.read()); //the hash 
      });
  });
}

async function generate() {

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  if (!fs.existsSync(swaggerJar)) {
    await download(`http://central.maven.org/maven2/io/swagger/swagger-codegen-cli/${version}/swagger-codegen-cli-${version}.jar`, swaggerJar);
  }

  if (!fs.existsSync(output)) {
    fs.mkdirSync(output);
  }

  const hash = await download(endpoint, swaggerJson);
  if (hash !== lastHash) {
    lastHash = hash;
    console.log('Swagger schema has changed, regenerating');
    // Change in schema
    await new Promise((resolve, reject) => {
      const proc = child_process.spawn('java', [
        '-jar', swaggerJar, 'generate',
        '-l', format,
        '-i', swaggerJson,
        '-o', output,
        '--remove-operation-id-prefix'
      ], {
        env: process.env
      });
      proc
        .on('close', resolve)
        .on('exit', resolve)
        .on('error', reject);
    });
  }
}

async function generateLive() {
  while (true) {
    try {
      await generate();
    } catch (e) {
      // Ignore
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

if (process.env.WATCH) {
  generateLive()
    .then(x => console.log('Finished'));
} else {
  generate()
    .then(() => {
      console.log('Success');
    }, (err) => {
      console.error(err);
    });
}