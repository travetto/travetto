import * as vscode from 'vscode';
import * as util from 'util';

import { TestResult, ErrorHoverAssertion, StatusUnknown } from './types';
import { Workspace } from '../../../core/workspace';

/**
 * Make a color
 * @param r
 * @param g
 * @param b
 * @param a
 */
const rgba = (r = 0, g = 0, b = 0, a = 1) => `rgba(${r},${g},${b},${a})`;

/**
 * Italicizes
 */
const ITALIC = 'font-style: italic;';

/**
 * Various styles
 */
const Style = {
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
  } as Partial<vscode.DecorationRenderOptions>,
  ASSERT: {
    isWholeLine: false,
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    borderWidth: '0 0 0 4px',
    borderStyle: 'solid',
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    after: { textDecoration: `none; ${ITALIC}` },
    light: { after: { color: 'darkgrey' } },
    dark: { after: { color: 'grey' } }
  } as Partial<vscode.DecorationRenderOptions>
} as const;

/**
 * Decoration utils
 */
export class Decorations {

  /**
   * Build an error hover tooltip
   * @param asrt
   */
  static buildErrorHover(asrt: ErrorHoverAssertion) {
    let title: string;
    let body: string;
    let bodyFirst: string;
    let suffix = asrt.message;

    if ('errors' in asrt.error) {
      title = (asrt.error as { message: string }).message;
      const messages = (asrt.error as unknown as { errors: (Error | string)[] }).errors
        .map(x => typeof x === 'string' ? x : x.message);

      suffix = `(${title}) ${messages.join(', ')}`;
      if (suffix.length > 60) {
        suffix = title;
      }
      body = `\t${messages.join('  \n\t')}  `;
      bodyFirst = `${title} - ${messages.join(', ')}`;
    } else if (asrt.expected !== undefined && asrt.actual !== undefined) {
      title = asrt.message
        .replace(/^.*should/, 'Should');

      const extra = title.split(/^Should(?:\s+[a-z]+)+/)[1];
      title = title.replace(extra, '');

      if (suffix.length > 50) {
        suffix = title;
      }

      const getVal = (str: unknown) => {
        try {
          return util.inspect(JSON.parse(str as string), false, 10).replace(/\n/g, '  \n\t');
        } catch (e) {
          return str;
        }
      };

      if (/equal/i.test(asrt.operator!)) {
        body = `\tExpected: \n\t${getVal(asrt.expected)} \n\tActual: \n\t${getVal(asrt.actual)} \n`;
      } else {
        body = `\t${asrt.message}`;
      }
      bodyFirst = asrt.message;
    } else {
      title = asrt.error.message;
      suffix = asrt.error.message;

      body = asrt.error.stack!;
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
  static buildAssertStyle(state: StatusUnknown) {
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
  static buildImage(state: StatusUnknown, size: string = Style.FULL_IMAGE) {
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
  static buildSuite(suite: { lines: { start: number } }) {
    return { ...this.line(suite.lines.start) };
  }

  /**
   * Build test config
   * @param test
   */
  static buildTest(test: { lines: { start: number } }) {
    let err: ErrorHoverAssertion | undefined;
    if ('error' in test) {
      const tt = test as TestResult;
      err = ((tt.assertions || []).find(x => x.status === 'failed') as ErrorHoverAssertion) ||
        (tt.error && { error: tt.error, message: tt.error.message });
    }
    if (err) {
      const hover = this.buildErrorHover(err);
      const tt = test as TestResult;
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
  static buildStyle(entity: 'assertion' | 'test' | 'suite', state: StatusUnknown) {
    return (entity === 'assertion') ?
      this.buildAssertStyle(state) :
      this.buildImage(state, entity === 'test' ? Style.SMALL_IMAGE : Style.FULL_IMAGE);
  }
}
