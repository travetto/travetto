import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

import { Log } from '../src/log.ts';

@Suite()
class CompilerLogTests {
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
        Log.level = 'info';
        Log.disabled = true; // explicitly quiet for test
        const logger = Log.scoped('test');
        logger.info('suppressed info message');
        assert.strictEqual(captured.length, 0);

        logger.error('visible error message');
        assert.strictEqual(captured.length, 1);
        assert(captured[0].includes('visible error message'));

        // When disabled is false, output is allowed
        logger.disabled = false;
        logger.info('visible info message');
        assert.strictEqual(captured.length, 2);
        assert(captured[1].includes('visible info message'));
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
      Log.level = 'info';
      Log.disabled = false;
    }
  }

  @Test()
  async verifyLoggerSuppressionUnderBuildNone() {
    const originalBuild = process.env.TRV_BUILD;
    try {
      process.env.TRV_BUILD = 'none';
      const captured: string[] = [];
      const originalConsoleError = console.error;
      console.error = (message?: unknown, ...parameters: unknown[]) => {
        captured.push(`error: ${message} ${parameters.join(' ')}`);
      };
      try {
        const logger = Log.scoped('test-none');
        logger.error('should be suppressed');
        assert.strictEqual(captured.length, 0);
      } finally {
        console.error = originalConsoleError;
      }
    } finally {
      if (originalBuild !== undefined) {
        process.env.TRV_BUILD = originalBuild;
      } else {
        delete process.env.TRV_BUILD;
      }
    }
  }

  @Test()
  async verifyLevelAndDisabledDecoupled() {
    Log.level = 'debug';
    assert.strictEqual(Log.level, 'debug');

    Log.disabled = false;
    assert.strictEqual(Log.disabled, false);

    // Changing level should not affect disabled
    Log.level = 'error';
    assert.strictEqual(Log.level, 'error');
    assert.strictEqual(Log.disabled, false);

    // Changing disabled should not affect level
    Log.disabled = true;
    assert.strictEqual(Log.disabled, true);
    assert.strictEqual(Log.level, 'error');

    // Scoped loggers copy values from parent at creation time and preserve scope
    const scopedLogger = Log.scoped('scoped-test');
    assert.strictEqual(scopedLogger.scope, 'scoped-test');
    assert.strictEqual(scopedLogger.level, 'error');
    assert.strictEqual(scopedLogger.disabled, true);

    // Updating parent does not retroactively change child
    Log.level = 'info';
    Log.disabled = false;
    assert.strictEqual(scopedLogger.scope, 'scoped-test');
    assert.strictEqual(scopedLogger.level, 'info');
    assert.strictEqual(scopedLogger.disabled, false);
    assert.strictEqual(Log.level, 'info');
    assert.strictEqual(Log.disabled, false);
  }
}
