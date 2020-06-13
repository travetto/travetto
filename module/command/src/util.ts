import * as https from 'https';
import * as http from 'http';
import * as net from 'net';
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

  /**
   * Wait for a TCP port to become available
   */
  static async waitForPort(port: number, ms = 5000) {
    const start = Date.now();
    while ((Date.now() - start) < ms) {
      try {
        await new Promise((res, rej) => {
          try {
            const sock = net.createConnection(port, 'localhost');
            sock.on('connect', () => {
              res();
              sock.destroy();
            });
            sock.on('timeout', rej);
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