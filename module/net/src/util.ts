import * as path from 'path';
import * as os from 'os';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';

import { HttpRequest } from './request';

import { FsUtil, StreamUtil } from '@travetto/boot';
import { Util } from '@travetto/base';

const tmpDir = FsUtil.toUnix(os.tmpdir());

/**
 * Common network utilities
 */
export class NetUtil {
  /**
   * Download a URL to a file on disk
   */
  static async download(url: string) {
    const name = `${Util.uuid()}.${path.basename(url)}`;
    const filePath = FsUtil.resolveUnix(tmpDir, name);

    await HttpRequest.exec({
      url,
      async responseHandler(msg: http.IncomingMessage) {
        await StreamUtil.writeToFile(msg, filePath);
      }
    });

    return filePath;
  }


  static async waitForHttp(url: string, ms = 5000) {
    const start = Date.now();
    const port = /:\d+/.test(url) ? parseInt(url.replace(/.*:(\d+).*/, (all, p) => p), 10) : (url.startsWith('https') ? 443 : 80);
    console.debug('Waiting for port', port);
    await this.waitForPort(port, ms);
    console.debug('Acquired port', port);

    while ((Date.now() - start) < ms) {
      const status = await new Promise<number>((resolve) => {
        try {
          const client = url.startsWith('https') ? https : http;
          const req = client.get(url, (msg) =>
            msg
              .on('data', () => { }) // Consume data
              .on('error', (err) => resolve(500))
              .on('end', () => resolve((msg.statusCode || 200)))
              .on('close', () => resolve((msg.statusCode || 200))));
          req.on('error', (err) => resolve(500));
        } catch (e) {
          resolve(400);
        }
      });
      if (status >= 200 && status <= 299) {
        return; // We good
      }
      await new Promise(res => setTimeout(res, 100));
    }
  }

  static async waitForPort(port: number, ms = 5000) {
    const start = Date.now();
    while ((Date.now() - start) < ms) {
      try {
        await new Promise((res, rej) => {
          try {
            const sock = net.createConnection(port, 'localhost');
            sock.on('connect', () => {
              sock.destroy();
              res();
            });
            sock.on('error', rej);
          } catch (e) {
            rej(e);
          }
        });
        return;
      } catch (e) {
        await new Promise(res => setTimeout(res, 50));
      }
    }
    throw new Error('Could not acquire port');
  }
}