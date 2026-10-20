import assert from 'node:assert';

import type { ManifestContext } from '@travetto/manifest';
import { Suite, Test } from '@travetto/test';

import { CompilerServer } from '../src/server/server.ts';
import { CompilerReset, type CompilerEvent } from '../src/types.ts';

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

    const softReset = new CompilerReset('Soft Reset', undefined, { soft: true });
    assert.ok(softReset instanceof CompilerReset);
    assert.strictEqual(softReset.soft, true);

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
}
