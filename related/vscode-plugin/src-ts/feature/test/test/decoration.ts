import * as vscode from 'vscode';
import * as util from 'util';

import { TestResult, ErrorHoverAssertion, StatusUnknown, TestConfig, Assertion } from './types';
import { Workspace } from '../../../core/workspace';

/**
 * Make a color
 * @param r
 * @param g
 * @param b
 * @param a
 */
const rgba = (r = 0, g = 0, b = 0, a = 1): string => `rgba(${r},${g},${b},${a})`;

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
const Style: {
  SMALL_IMAGE: string;
  FULL_IMAGE: string;
  COLORS: Record<TestResult['status'] | 'unknown', string>;
  IMAGE: Partial<vscode.DecorationRenderOptions>;
  ASSERT: Partial<vscode.DecorationRenderOptions>;
} = {
  SMALL_IMAGE: '40%',
  FULL_IMAGE: 'auto',
  COLORS: {
    skipped: rgba(255, 255, 255, 0.5),
    failed: rgba(255, 0, 0, 0.5),
    passed: rgba(0, 255, 0, .5),
    unknown: rgba(255, 255, 255, .5)
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
    after: { textDecoration: `none; ${ITALIC}` },
    light: { after: { color: 'darkgrey' } },
    dark: { after: { color: 'grey' } }
  }
};

function isBatchError(o?: Error): o is Error & { errors: (Error | string)[] } {
  return !!o && o instanceof Error && 'errors' in o;
}

/**
 * Decoration utils
 */
export class Decorations {

  /**
   * Build an error hover tooltip
   * @param assertion
   */
  static buildErrorHover(assertion: Assertion | ErrorHoverAssertion): DecorationConfig {
    let title: string;
    let body: string;
    let bodyFirst: string;
    let suffix = assertion.message;
    const error = assertion.error!;

    if (isBatchError(error)) {
      title = error.message;
      const messages = error.errors
        .map(x => typeof x === 'string' ? x : x.message);

      suffix = `(${title}) ${messages.join(', ')}`;
      if (suffix.length > 60) {
        suffix = title;
      }
      body = `\t${messages.join('  \n\t')}  `;
      bodyFirst = `${title} - ${messages.join(', ')}`;
    } else if (assertion.expected !== undefined && assertion.actual !== undefined) {
      title = assertion.message
        .replace(/^.*should/, 'Should');

      const extra = title.split(/^Should(?:\s+[a-z]+)+/)[1];
      title = title.replace(extra, '');

      if (suffix.length > 50) {
        suffix = title;
      }

      const getVal = (val: unknown): string => {
        try {
          return util.inspect(JSON.parse(`${val}`), false, 10).replace(/\n/g, '  \n\t');
        } catch {
          return `${val}`;
        }
      };

      if (/equal/i.test(assertion.operator!)) {
        body = `\tExpected: \n\t${getVal(assertion.expected)} \n\tActual: \n\t${getVal(assertion.actual)} \n`;
      } else {
        body = `\t${assertion.message}`;
      }
      bodyFirst = assertion.message;
    } else {
      title = error.message;
      suffix = error.message;

      body = error.stack!;
      bodyFirst = body.split('\n')[0];
    }
    return { suffix, title, bodyFirst, body, markdown: new vscode.MarkdownString(`**${title}** \n\n${body}`) };
  }

  /**
   * Create a line range
   * @param n
   * @param end
   */
  static line(n: number, end: number = 0): vscode.DecorationOptions {
    return { range: new vscode.Range(n - 1, 0, (end || n) - 1, 100000000000) };
  }

  /**
   * Build assertion
   * @param state
   */
  static buildAssertStyle(state: StatusUnknown): vscode.TextEditorDecorationType {
    const color = Style.COLORS[state];
    return vscode.window.createTextEditorDecorationType({
      ...Style.ASSERT,
      borderColor: color,
      overviewRulerColor: state === 'failed' ? color : '',
    });
  }

  /**
   * Build guardrail image for assertion status
   * @param state
   * @param size
   */
  static buildImage(state: StatusUnknown, size: string = Style.FULL_IMAGE): vscode.TextEditorDecorationType {
    const img = Workspace.getAbsoluteResource(`images/${state}.png`);
    return vscode.window.createTextEditorDecorationType({
      ...Style.IMAGE,
      gutterIconPath: img,
      gutterIconSize: size
    });
  }

  /**
   * Build assertion
   * @param assertion
   */
  static buildAssertion(assertion: { error?: Error, line: number, lineEnd?: number, message: string }): vscode.DecorationOptions {
    let out = this.line(assertion.line, assertion.lineEnd);
    if (assertion.error) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const { suffix, markdown } = this.buildErrorHover(assertion as ErrorHoverAssertion);

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
  static buildSuite(suite: { lines: { start: number } }): vscode.DecorationOptions {
    return { ...this.line(suite.lines.start) };
  }

  /**
   * Build test config
   * @param test
   */
  static buildTest(test: TestResult | TestConfig): vscode.DecorationOptions {
    let err: ErrorHoverAssertion | undefined;
    if ('error' in test) {
      const tt = test;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      err = ((tt.assertions || []).find(x => x.status === 'failed') as ErrorHoverAssertion) ||
        (tt.error && { error: tt.error, message: tt.error.message });
    }
    if (err) {
      const hover = this.buildErrorHover(err);
      const tt = test;
      return {
        ...this.line(tt.lines.start),
        hoverMessage: hover.markdown
      };
    } else {
      return this.line(test.lines.start);
    }
  }

  /**
   * Build style
   * @param entity
   * @param state
   */
  static buildStyle(entity: 'assertion' | 'test' | 'suite', state: StatusUnknown): vscode.TextEditorDecorationType {
    return (entity === 'assertion') ?
      this.buildAssertStyle(state) :
      this.buildImage(state, entity === 'test' ? Style.SMALL_IMAGE : Style.FULL_IMAGE);
  }
}
