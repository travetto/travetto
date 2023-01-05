import { RGB, TermColorField, TermCoord, TermState } from './types';
import { ColorDefineUtil } from './color-define';
import { ANSICodes, DeviceStatusField, OSCQueryField } from './codes';

const to256 = (x: string): number => Math.trunc(parseInt(x, 16) / (16 ** (x.length - 2)));
const COLOR_RESPONSE = /(?<r>][0-9a-f]+)[/](?<g>[0-9a-f]+)[/](?<b>[0-9a-f]+)[/]?(?<a>[0-9a-f]+)?/i;
const POSITION_RESPONSE = /(?<r>\d*);(?<c>\d*)/i;

/**
 * Terminal utilities
 */
export class TerminalUtil {

  static removeAnsiSequences(output: string): string {
    // eslint-disable-next-line no-control-regex
    return output.replace(/(\x1b|\x1B)\[[?]?[0-9;]+[A-Za-z]/g, '');
  }

  static debugSequences(output: string): string {
    return output.replaceAll('\x1b[', '<ESC>').replaceAll('\x1b]', '<OSC>').replaceAll('\n', '<NL>');
  }

  /**
   * Read foreground/background color if env var is set
   */
  static readColorFgBgEnvVar(color: string | undefined = process.env.COLORFGBG): { fg: RGB, bg: RGB } | undefined {
    if (color) {
      const [fg, bg] = color.split(';');
      return {
        fg: ColorDefineUtil.rgbFromAnsi256(+fg),
        bg: ColorDefineUtil.rgbFromAnsi256(+bg),
      };
    }
  }

  /**
   * Read input given term state
   */
  static readInput({ input, output }: TermState, query: string): Promise<Buffer> {
    input.setRawMode(true);
    // Send data, but do not wait on it
    output.write(query);
    return new Promise<Buffer | string>(res => input.once('readable', () => res(input.read())))
      .finally(() => input.setRawMode(false))
      .then(x => typeof x === 'string' ? Buffer.from(x, 'utf8') : x);
  }


  /** Parse xterm color response */
  static parseColorResponse(response: Buffer): RGB {
    const groups = response.toString('utf8').match(COLOR_RESPONSE)?.groups ?? {};
    return [to256(groups.r), to256(groups.g), to256(groups.b)];
  }

  /** Parse cursor query response into {x,y} */
  static parseCursorPosition(response: Buffer): TermCoord {
    const groups = response.toString('utf8').match(POSITION_RESPONSE)?.groups ?? {};
    return { x: +(groups.c || 1) - 1, y: +(groups.r || 1) - 1 };
  }

  /**
   * Executes xterm query against the term
   */
  static oscQuery(term: TermState, field: TermColorField): Promise<RGB>;
  static oscQuery(term: TermState, field: OSCQueryField): Promise<Buffer | RGB> {
    const res = this.readInput(term, ANSICodes.OSC_QUERY(field));
    if (field === 'foregroundColor' || field === 'backgroundColor') {
      return res.then(v => this.parseColorResponse(v));
    }
    return res;
  }

  /**
   * Executes a device status report query against the term
   */
  static deviceStatusReport(term: TermState, field: 'cursorPosition'): Promise<TermCoord>;
  static deviceStatusReport(term: TermState, field: DeviceStatusField): Promise<Buffer | TermCoord> {
    const res = TerminalUtil.readInput(term, ANSICodes.DEVICE_STATUS_REPORT(field));
    if (field === 'cursorPosition') {
      return res.then(v => this.parseCursorPosition(v));
    }
    return res;
  }
}