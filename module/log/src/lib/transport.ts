import * as winston from 'winston';
import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import { Formatters } from './formatter';
import { isFileTransport, BaseConfig } from './types';
let pkg = JSON.parse(fs.readFileSync(process.cwd() + '/package.json').toString());
let simpleName = (pkg.name as string).replace(/[@]/g, '').replace(/[\/]/g, '_');

export function processTransportConfig<T extends BaseConfig>(conf: T): winston.TransportInstance | undefined {
  if (isFileTransport(conf)) {
    if (!conf.filename) {
      conf.filename = `${simpleName}-${conf.name}.log`;
    }
    if (!conf.filename.startsWith('/')) {
      conf.filename = `${process.cwd()}/logs/${conf.filename}`;
    }

    // Setup folder for logging
    mkdirp.sync(conf.filename.substring(0, conf.filename.lastIndexOf('/')));
  }

  if (conf.formatter) {
    if (conf.formatter in Formatters) {
      conf.formatter = (Formatters as any)[conf.formatter];
    } else {
      throw new Error('Unknown formatter ' + conf.formatter);
    }
  }

  switch (conf.type) {
    case 'file': return new winston.transports.File(conf as any);
    case 'console': return new winston.transports.Console(conf as any);
    case 'http': return new winston.transports.Http(conf as any);
  }
}