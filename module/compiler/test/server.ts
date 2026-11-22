import assert from 'node:assert';
import http from 'node:http';

import type { ManifestContext } from '@travetto/manifest';
import { Suite, Test } from '@travetto/test';

import { CompilerClient } from '../src/server/client.ts';
import { CompilerServer } from '../src/server/server.ts';
import { CompilerReset, type CompilerEvent, type CompilerServerInfo } from '../src/types.ts';

@Suite()
class CompilerServerTests {
  #createContext(): ManifestContext {
    return {
      workspace: { name: 'test-app', path: '/test/app', mono: false, manager: 'npm' },
      build: { compilerUrl: 'http://localhost:20000', outputFolder: '.trv/output', toolFolder: '.trv/tool', typesFolder: '.trv/types' },
      main: { name: 'test-app', folder: '', version: '1.0.0' }
    };
  }

  @Test()
  async verifyErrorNormalizationAndCleanup() {
    const context = this.#createContext();
    const server = new CompilerServer(context, false);

    const events: CompilerEvent[] = [
      {
        type: 'log',
        payload: {
          level: 'error',
          message: 'ERROR src/alpha.ts:10:5 -- Type error',
          phase: 'error',
          file: 'src/alpha.ts'
        }
      },
      {
        type: 'log',
        payload: {
          level: 'error',
          message: 'ERROR src/beta.ts:20:8 -- Syntax error',
          phase: 'error',
          file: 'src/beta.ts'
        }
      }
    ];

    async function* generateEvents(): AsyncIterable<CompilerEvent> {
      for (const event of events) {
        yield event;
      }
    }

    await server.processEvents(() => generateEvents());

    assert.strictEqual(server.info.messages?.error?.length, 2);
    assert.strictEqual(server.info.messages?.error?.[0].file, 'src/alpha.ts');
    assert.strictEqual(server.info.messages?.error?.[1].file, 'src/beta.ts');

    // Failure event for alpha should replace alpha errors
    const failureEvents: CompilerEvent[] = [
      {
        type: 'log',
        payload: {
          level: 'error',
          message: 'Compilation failed',
          phase: 'failure',
          file: 'src/alpha.ts'
        }
      }
    ];

    await server.processEvents(async function* () {
      for (const event of failureEvents) {
        yield event;
      }
    });

    assert.strictEqual(server.info.messages?.error?.length, 1);
    assert.strictEqual(server.info.messages?.error?.[0].file, 'src/beta.ts');
    assert.strictEqual(server.info.messages?.failure?.[0].file, 'src/alpha.ts');

    // Change event for beta should clear beta error
    const changeEvents: CompilerEvent[] = [
      {
        type: 'change',
        payload: {
          action: 'update',
          file: 'src/beta.ts',
          import: 'test-app/src/beta.ts',
          output: '.trv/output/src/beta.js',
          module: 'test-app',
          time: Date.now()
        }
      }
    ];

    await server.processEvents(async function* () {
      for (const event of changeEvents) {
        yield event;
      }
    });

    assert.strictEqual(server.info.messages?.error, undefined);
  }

  @Test()
  async verifyCompilerEvents() {
    const context = this.#createContext();
    const server = new CompilerServer(context, false);

    const reset = new CompilerReset('Reset');
    assert.ok(reset instanceof CompilerReset);
    assert.strictEqual(reset.soft, undefined);

    const softReset = new CompilerReset('Soft Reset', { soft: true });
    assert.ok(softReset instanceof CompilerReset);
    assert.strictEqual(softReset.soft, true);

    const filesReset = new CompilerReset('Files Reset', { files: ['a.ts'] });
    assert.ok(filesReset instanceof CompilerReset);
    assert.deepStrictEqual(filesReset.files, ['a.ts']);

    assert.strictEqual(server.isResetEvent({ type: 'state', payload: { state: 'reset' } }), true);
    assert.strictEqual(server.isResetEvent({ type: 'state', payload: { state: 'reset', soft: true } }), true);
    assert.strictEqual(server.isResetEvent({ type: 'state', payload: { state: 'compile-start' } }), false);
  }

  @Test()
  async verifyResetHandling() {
    const context = this.#createContext();
    const server = new CompilerServer(context, false);
    const initialIteration = server.info.iteration;

    server.info.messages = {
      error: [
        {
          level: 'error',
          message: 'ERROR src/alpha.ts:10:5 -- Type error',
          phase: 'error',
          file: 'src/alpha.ts'
        }
      ]
    };

    let executed = false;
    await server.processEvents(async function* () {
      if (!executed) {
        executed = true;
        yield {
          type: 'state',
          payload: {
            state: 'reset'
          }
        };
      }
    });

    assert.deepStrictEqual(server.info.messages, {});
    assert.ok(server.info.iteration > initialIteration);
  }

  @Test()
  async verifySoftResetHandling() {
    const context = this.#createContext();
    const server = new CompilerServer(context, false);
    const initialIteration = server.info.iteration;

    server.info.messages = {
      error: [
        {
          level: 'error',
          message: 'ERROR src/alpha.ts:10:5 -- Type error',
          phase: 'error',
          file: 'src/alpha.ts'
        }
      ]
    };

    let executed = false;
    await server.processEvents(async function* () {
      if (!executed) {
        executed = true;
        yield {
          type: 'state',
          payload: {
            state: 'reset',
            soft: true
          }
        };
      }
    });

    assert.strictEqual(server.info.messages?.error?.length, 1);
    assert.strictEqual(server.info.iteration, initialIteration);
  }

  @Test()
  async verifyWaitForWatchReadyWaitsOnResetAndCompileEnd() {
    for (const initialState of ['reset', 'compile-end'] as const) {
      let infoState: CompilerServerInfo['state'] = initialState;
      const server = http.createServer((request, response) => {
        if (request.url === '/info') {
          response.setHeader('Content-Type', 'application/json');
          response.end(
            JSON.stringify({
              path: '/test/app',
              serverProcessId: process.pid,
              compilerProcessId: process.pid,
              state: infoState,
              watching: true,
              iteration: 1,
              url: ''
            })
          );
        } else if (request.url === '/event/state') {
          response.writeHead(200);
          response.write(`${JSON.stringify({ state: infoState })}\n`);
          setTimeout(() => {
            infoState = 'watch-start';
            response.write(`${JSON.stringify({ state: 'watch-start' })}\n`);
          }, 30);
        }
      });

      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
      try {
        const address = server.address() as { port: number };
        const context = this.#createContext();
        context.build.compilerUrl = `http://127.0.0.1:${address.port}`;
        const client = new CompilerClient(context, {
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: () => {}
        });

        const ready = await client.waitForWatchReady();
        assert.strictEqual(ready, true);
      } finally {
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
      }
    }
  }

  @Test()
  async verifyIdleTimeoutResetsOnActivityAndDefersDuringCompile() {
    const context = this.#createContext();
    context.build.compilerUrl = 'http://127.0.0.1:0';
    const server = new CompilerServer(context, true, 60);

    try {
      // Wait past the 60ms idle window while compiling; server must NOT close
      await server.processEvents(async function* () {
        yield { type: 'state', payload: { state: 'compile-start' } };
        await new Promise(resolve => setTimeout(resolve, 100));
        assert.strictEqual(server.signal.aborted, false);
        yield { type: 'state', payload: { state: 'watch-start' } };
      });
    } finally {
      if (!server.signal.aborted) {
        await server.close();
      }
    }
  }

  @Test()
  async verifyMultiFileFailuresRetainedAndClearedIndividually() {
    const context = this.#createContext();
    const server = new CompilerServer(context, false);

    await server.processEvents(async function* () {
      yield { type: 'log', payload: { level: 'error', message: 'Compilation failed', phase: 'failure', file: 'src/alpha.ts' } };
      yield { type: 'log', payload: { level: 'error', message: 'Compilation failed', phase: 'failure', file: 'src/beta.ts' } };
    });

    assert.strictEqual(server.info.messages?.failure?.length, 2);

    await server.processEvents(async function* () {
      yield {
        type: 'change',
        payload: {
          action: 'update',
          file: 'src/alpha.ts',
          import: 'test-app/src/alpha.ts',
          output: '.trv/output/src/alpha.js',
          module: 'test-app',
          time: Date.now()
        }
      };
    });

    assert.strictEqual(server.info.messages?.failure?.length, 1);
    assert.strictEqual(server.info.messages?.failure?.[0].file, 'src/beta.ts');
  }
}
