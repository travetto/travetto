import assert from 'node:assert';
import http from 'node:http';
import { Readable } from 'node:stream';

import { Suite, Test } from '@travetto/test';
import { WebResponse } from '@travetto/web';

import { WebHttpUtil } from '../src/http.ts';

@Suite()
export class PrematureCloseTest {
  @Test()
  async testPrematureClose(): Promise<void> {
    const serverHandle = await WebHttpUtil.startHttpServer({
      bindAddress: '127.0.0.1',
      port: 0,
      dispatcher: {
        dispatch: async () => {
          let count = 0;
          const stream = new Readable({
            read(): void {
              if (count++ < 100) {
                this.push(Buffer.from('streaming data chunk\n'));
              } else {
                this.push(null);
              }
            }
          });
          return new WebResponse({
            context: { httpStatusCode: 200 },
            headers: new Headers({ 'Content-Type': 'text/plain' }),
            body: stream
          });
        }
      }
    });

    const address = serverHandle.target.address();
    assert(typeof address === 'object' && address !== null);
    const resolvedPort = address.port;

    // Send a request and abruptly destroy the client connection mid-stream
    await new Promise<void>(resolve => {
      const clientRequest = http.get(`http://127.0.0.1:${resolvedPort}/`, clientResponse => {
        clientResponse.on('data', () => {
          clientRequest.destroy();
          resolve();
        });
      });
      clientRequest.on('error', () => {
        resolve();
      });
    });

    // Pause briefly to allow server response cleanup
    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify the server remains fully operational for subsequent requests
    const healthyResponseStatusCode = await new Promise<number>((resolve, reject) => {
      const followUpRequest = http.get(`http://127.0.0.1:${resolvedPort}/`, followUpResponse => {
        followUpResponse.resume();
        followUpResponse.on('end', () => resolve(followUpResponse.statusCode ?? 0));
      });
      followUpRequest.on('error', reject);
    });

    assert(healthyResponseStatusCode === 200);

    await serverHandle.stop(true);
  }
}
