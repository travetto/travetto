import vscode from 'vscode';
import util from 'node:util';

import type { TestResult, Assertion, TestConfig, TestLog, TestStatus } from '@travetto/test';
import { JSONUtil } from '@travetto/runtime';

import type { ErrorHoverAssertion, TestLevel } from './types.ts';
import { Workspace } from '../../../core/workspace.ts';
import { ThemeUtil } from '../../../core/theme.ts';
import { Log } from '../../../core/log.ts';

const MAX_LOG_LENGTH = 60;

type ImageSize = 'small' | 'full';

/**
 * Italicizes
 */
const ITALIC = 'font-style: italic;';

type DecorationConfig = {
  suffix: string;
  title: string;
  bodyFirst: string;
  body: string;
  markdown: vscode.MarkdownString;
};

/**
 * Various styles
 */
export const Style: {
  COLORS: Record<TestStatus, vscode.ThemeColor>;
  IMAGE: Partial<vscode.DecorationRenderOptions>;
  ASSERT: Partial<vscode.DecorationRenderOptions>;
} = {
  COLORS: {
    skipped: new vscode.ThemeColor('editorGutter.modifiedBackground'),
    failed: new vscode.ThemeColor('editorGutter.deletedBackground'),
    passed: new vscode.ThemeColor('editorGutter.addedBackground'),
    unknown: new vscode.ThemeColor('editor.inactiveSelectionBackground'),
  },
  IMAGE: {
    isWholeLine: false,
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  },
  ASSERT: {
    isWholeLine: false,
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    borderWidth: '0 0 0 4px',
    borderStyle: 'solid',
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    after: {
      textDecoration: `none; ${ITALIC}`,
      color: new vscode.ThemeColor('badge.background')
    },
  }
};

function isBatchError(value?: Error): value is Error & { details: { errors: (Error | string)[] } } {
  return !!value && value instanceof Error && 'errors' in value;
}

/**
 * Decoration utils
 */
export class Decorations {

  static #imageUris: Record<string, vscode.Uri> = {};

  /**
   * Build an error hover tooltip
   * @param assertion
   */
  static buildErrorHover(assertion: Assertion | ErrorHoverAssertion): DecorationConfig {
    let title: string;
    let body: string;
    let bodyFirst: string;
    let suffix = assertion.message || '';
    const error = assertion.error!;

    if (isBatchError(error)) {
      title = error.message;
      const messages = error.details.errors
        .map(subError => typeof subError === 'string' ? subError : subError.message);

      suffix = `(${title}) ${messages.join(', ')}`;
      if (suffix.length > 120) {
        suffix = title;
      }
      body = `\t${messages.join('  \n\t')}  `;
      bodyFirst = `${title} - ${messages.join(', ')}`;
    } else if (!(assertion.expected === undefined && assertion.actual === undefined)) {
      title = assertion.message!
        .replace(/^.*should/, 'Should');

      const extra = title.split(/^Should(?:\s+[a-z]+)+/)[1];
      title = title.replace(extra, '');

      if (suffix.length > 120) {
        suffix = title;
      }

      const getValue = (value: unknown): string => {
        try {
          return util.inspect(JSONUtil.parseSafe(`${value}`), false, 10).replace(/\n/g, '  \n\t');
        } catch {
          return `${value}`;
        }
      };

      if (/equal/i.test(assertion.operator!)) {
        body = `\tExpected: \n\t${getValue(assertion.expected)} \n\tActual: \n\t${getValue(assertion.actual)} \n`;
      } else {
        body = `\t${assertion.message}`;
      }
      bodyFirst = assertion.message!;
    } else {
      title = error.message;
      suffix = error.message;

      body = (error.stack ?? '')
        .replaceAll(Workspace.path, '.')
        .replaceAll('\n', '  \n')
        .replace(
          /[(]([^):]+)[:]?(\d+(?:[:]\d+)?)?[)]/g, (_, file, loc) => loc ? `(**${file}**:_${loc}_)` : `(**${file}**)`
        );
      bodyFirst = body.split('\n')[0];
    }
    return { suffix, title, bodyFirst, body, markdown: new vscode.MarkdownString(`**${title}** \n\n${body}`) };
  }

  /**
   * Create a line range
   * @param start
   * @param end
   */
  static line(start: number, end: number = 0): vscode.DecorationOptions {
    return { range: new vscode.Range(start - 1, 0, (end || start) - 1, 100000000000) };
  }

  /**
   * Build assertion
   * @param state
   */
  static buildAssertStyle(state: TestStatus): vscode.TextEditorDecorationType {
    const color = Style.COLORS[state];
    return vscode.window.createTextEditorDecorationType({
      ...Style.ASSERT,
      borderColor: color,
      overviewRulerColor: state === 'failed' ? color : '',
    });
  }

  /**
   * Build or get cached image uri
   */
  static getImageUri(state: TestStatus, size: ImageSize): vscode.Uri {
    const key = `${state}-${size}`;
    if (!this.#imageUris[key]) {
      const color = ThemeUtil.getTokenColor(Style.COLORS[state].id);
      const relativeSize = size === 'small' ? 40 : 60;
      const offset = (100 - relativeSize) / 2;
      const gutterWidth = 16;
      const svg =
        `<svg 
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 100 100"
          width="${gutterWidth}" height="${gutterWidth}"
        >
          <rect x="${offset}" y="${offset}" width="${relativeSize}" height="${relativeSize}" stroke-width="0" fill="${color}" />
        </svg>`;

      new Log('test:decoration').debug(`Generated SVG for state ${state}: ${svg}`);

      this.#imageUris[key] = vscode.Uri.parse(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
    }
    return this.#imageUris[key];
  }

  /**
   * Build guardrail image for assertion status
   * @param state
   * @param size
   */
  static buildImage(state: TestStatus, size: ImageSize): vscode.TextEditorDecorationType {
    const uri = this.getImageUri(state, size);
    return vscode.window.createTextEditorDecorationType({ ...Style.IMAGE, gutterIconPath: uri, gutterIconSize: 'auto' });
  }

  /**
   * Build Test Log decoration
   * @param log
   */
  static buildTestLog(log: TestLog): vscode.DecorationOptions {
    const lines = log.message.trim().split('\n');
    let hoverMessage: string | undefined;

    if (lines.length > 1 || lines[0].length > MAX_LOG_LENGTH) {
      hoverMessage = ['```', log.message ?? '', '```', ''].join('\n');
    }

    const message = [lines[0].substring(0, MAX_LOG_LENGTH), lines[0].length > MAX_LOG_LENGTH ? '...' : ''].join('');

    return {
      ...this.line(log.line),
      hoverMessage,
      renderOptions: {
        after: {
          textDecoration: ITALIC,
          color: log.level === 'error' || log.level === 'warn' ? new vscode.ThemeColor('errorForeground') : undefined,
          contentText: `  // ${log.level}: ${message}`
        }
      }
    };
  }

  /**
   * Build assertion
   * @param assertion
   */
  static buildAssertion(assertion: Assertion): vscode.DecorationOptions {
    let out = this.line(assertion.line);
    if (assertion.error) {
      const { suffix, markdown } = this.buildErrorHover(assertion);

      out = {
        ...out,
        hoverMessage: markdown,
        renderOptions: {
          after: {
            textDecoration: ITALIC,
            contentText: `    ${suffix} `
          }
        }
      };
    }
    return out;
  }

  /**
   * Build suite config
   * @param suite
   */
  static buildSuite(suite: { lineStart: number }): vscode.DecorationOptions {
    return { ...this.line(suite.lineStart) };
  }

  /**
   * Build test config
   * @param test
   */
  static buildTest(test: TestResult | TestConfig): vscode.DecorationOptions {
    let error: ErrorHoverAssertion | Assertion | undefined;
    if ('error' in test) {
      const tt = test;
      error = (tt.assertions || []).find(assertion => !!assertion.error) ||
        (tt.error && { error: tt.error, message: tt.error.message });
    }
    if (error) {
      const hover = this.buildErrorHover(error);
      const tt = test;
      return {
        ...this.line(tt.lineStart),
        hoverMessage: hover.markdown
      };
    } else {
      return this.line(test.lineStart);
    }
  }

  /**
   * Build style
   * @param entity
   * @param state
   */
  static buildStyle(entity: TestLevel, state: TestStatus): vscode.TextEditorDecorationType {
    return (entity === 'assertion') ?
      this.buildAssertStyle(state) :
      this.buildImage(state, entity === 'test' ? 'small' : 'full');
  }
}
