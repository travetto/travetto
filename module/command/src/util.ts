import * as https from 'https';
import * as http from 'http';
import * as net from 'net';

import { Util } from '@travetto/base';
import { ExecUtil } from '@travetto/boot';

/**
 * Utilities to support command execution
 */
export class CommandUtil {

  /**
   * Wait for the http url to return a valid response
   *
   * @param url URL to check
   * @param ms Maximum time to wait in milliseconds
   */
  static async waitForHttp(url: string, ms = 5000) {
    const start = Date.now();
    const port = /:\d+/.test(url) ? parseInt(url.replace(/.*:(\d+).*/, (all, p) => p), 10) : (url.startsWith('https') ? 443 : 80);
    await this.waitForPort(port, ms);

    while ((Date.now() - start) < ms) {
      const [status, body] = await new Promise<[number, string]>((resolve) => {
        const data: Buffer[] = [];
        const res = (s: number) => resolve([s, Buffer.concat(data).toString('utf8')]);
        try {
          const client = url.startsWith('https') ? https : http;
          const req = client.get(url, (msg) =>
            msg
              .on('data', (d) => { data.push(Buffer.from(d)); }) // Consume data
              .on('error', (err) => res(500))
              .on('end', () => res((msg.statusCode || 200)))
              .on('close', () => res((msg.statusCode || 200))));
          req.on('error', (err) => res(500));
        } catch {
          res(400);
        }
      });
      if (status >= 200 && status <= 299) {
        return body; // We good
      }
      await Util.wait(100);
    }
    throw new Error('Could not make http connection to url');
  }

  /**
   * Wait for a TCP port to become available
   */
  static async waitForPort(port: number, ms = 5000) {
    const start = Date.now();
    while ((Date.now() - start) < ms) {
      try {
        await new Promise((res, rej) => {
          try {
            const sock: net.Socket = net.createConnection(port, 'localhost')
              .on('connect', res)
              .on('connect', () => sock.destroy())
              .on('timeout', rej)
              .on('error', rej);
          } catch (err) {
            rej(err);
          }
        });
        return;
      } catch {
        await Util.wait(50);
      }
    }
    throw new Error('Could not acquire port');
  }

  /**
   * Find container id by label
   * @param label
   */
  static async findContainerByLabel(label: string) {
    return (await ExecUtil.spawn('docker', ['ps', '-q', '--filter', `label=${label}`]).result).stdout.trim();
  }

  /**
   * Kill container by id
   * @param cid
   */
  static async killContainerById(cid: string) {
    return await ExecUtil.spawn('docker', ['kill', cid]).result;
  }
}