import * as net from 'net';
import * as http from 'http';
import * as https from 'https';

// TODO: Document
export class ExecUtil {

  static async waitForHttp(url: string, ms = 5000) {
    const start = Date.now();
    const port = /:\d+/.test(url) ? parseInt(url.replace(/.*:(\d+).*/, (all, p) => p), 10) : (url.startsWith('https') ? 443 : 80);
    console.debug('Waiting for port', port);
    await ExecUtil.waitForPort(port, ms);
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