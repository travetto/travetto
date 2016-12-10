import Config from './config';
import * as winston from 'winston';
import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import { Formatters } from './formatter';

// Read package.json
let pkg = JSON.parse(fs.readFileSync(process.cwd() + '/package.json').toString());
let appName = (pkg.name as string).replace(/[@]/g, '').replace(/[\/]/g, '_');

export function processTransportConfig(conf: typeof Config.log): winston.TransportInstance | undefined {
  if (conf.type === 'file') {
    if (!conf.filename) {
      conf.filename = `${appName}.log`;
    }
    if (!conf.filename.startsWith('/')) {
      conf.filename = `${process.cwd()}/logs/${conf.filename}`;
    }

    // Setup folder for logging
    mkdirp.sync(conf.filename.substring(0, conf.filename.lastIndexOf('/')));
    if (conf.formatter === 'json') {
      (conf as any).json = true;
      conf.formatter = '';
    }
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