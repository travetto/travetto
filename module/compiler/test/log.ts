import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

import { IpcLogger, Logger } from '../src/log.ts';

@Suite()
class CompilerLogTests {
  @Test()
  async verifyIpcLoggerDecoupledFromQuiet() {
    const originalQuiet = process.env.TRV_QUIET;
    const originalBuild = process.env.TRV_BUILD;

    try {
      process.env.TRV_QUIET = '1';
      delete process.env.TRV_BUILD;

      const ipcLogger = new IpcLogger({ level: 'debug' });
      assert.strictEqual(ipcLogger.disabled, false);
      assert.strictEqual(ipcLogger.valid({ level: 'debug', message: 'test' }), true);
      assert.strictEqual(ipcLogger.valid({ level: 'info', message: 'test' }), true);
      assert.strictEqual(ipcLogger.valid({ level: 'error', message: 'test' }), true);

      process.env.TRV_QUIET = 'true';
      const ipcLoggerStrictTrue = new IpcLogger({ level: 'debug' });
      assert.strictEqual(ipcLoggerStrictTrue.disabled, false);
      assert.strictEqual(ipcLoggerStrictTrue.valid({ level: 'debug', message: 'test' }), true);

      process.env.TRV_BUILD = 'none';
      const disabledIpcLogger = new IpcLogger({ level: 'debug' });
      assert.strictEqual(disabledIpcLogger.disabled, true);
      assert.strictEqual(disabledIpcLogger.valid({ level: 'debug', message: 'test' }), false);
      assert.strictEqual(disabledIpcLogger.valid({ level: 'error', message: 'test' }), true);
    } finally {
      if (originalQuiet !== undefined) {
        process.env.TRV_QUIET = originalQuiet;
      } else {
        delete process.env.TRV_QUIET;
      }
      if (originalBuild !== undefined) {
        process.env.TRV_BUILD = originalBuild;
      } else {
        delete process.env.TRV_BUILD;
      }
    }
  }

  @Test()
  async verifyLoggerStdoutSuppressionUnderQuiet() {
    const originalQuiet = process.env.TRV_QUIET;
    const originalBuild = process.env.TRV_BUILD;

    try {
      process.env.TRV_QUIET = '1';
      delete process.env.TRV_BUILD;

      const captured: string[] = [];
      const originalConsoleInfo = console.info;
      const originalConsoleDebug = console.debug;
      const originalConsoleError = console.error;

      console.info = (message?: unknown, ...parameters: unknown[]) => {
        captured.push(`info: ${message} ${parameters.join(' ')}`);
      };
      console.debug = (message?: unknown, ...parameters: unknown[]) => {
        captured.push(`debug: ${message} ${parameters.join(' ')}`);
      };
      console.error = (message?: unknown, ...parameters: unknown[]) => {
        captured.push(`error: ${message} ${parameters.join(' ')}`);
      };

      try {
        const logger = new Logger({ level: 'info' });
        logger.info('suppressed info message');
        assert.strictEqual(captured.length, 0);

        logger.error('visible error message');
        assert.strictEqual(captured.length, 1);
        assert(captured[0].includes('visible error message'));

        // When TRV_BUILD is explicitly provided, output is allowed despite TRV_QUIET
        process.env.TRV_BUILD = 'debug';
        logger.level = 'debug';
        logger.debug('visible debug message');
        assert.strictEqual(captured.length, 2);
        assert(captured[1].includes('visible debug message'));
      } finally {
        console.info = originalConsoleInfo;
        console.debug = originalConsoleDebug;
        console.error = originalConsoleError;
      }
    } finally {
      if (originalQuiet !== undefined) {
        process.env.TRV_QUIET = originalQuiet;
      } else {
        delete process.env.TRV_QUIET;
      }
      if (originalBuild !== undefined) {
        process.env.TRV_BUILD = originalBuild;
      } else {
        delete process.env.TRV_BUILD;
      }
    }
  }
}
