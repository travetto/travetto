import { ColorLevel, RGB, TermBackgroundScheme, TermColorField, TermColorState, TermCoord, TermState } from './types';
import { ANSICodes, ANSI_CODE_REGEX, DeviceStatusField, OSCQueryField } from './codes';
import { ColorDefineUtil } from './color-define';

const to256 = (x: string): number => Math.trunc(parseInt(x, 16) / (16 ** (x.length - 2)));
const COLOR_RESPONSE = /(?<r>][0-9a-f]+)[/](?<g>[0-9a-f]+)[/](?<b>[0-9a-f]+)[/]?(?<a>[0-9a-f]+)?/i;
const POSITION_RESPONSE = /(?<r>\d*);(?<c>\d*)/i;

const COLOR_LEVEL_MAP = { 1: 0, 4: 1, 8: 2, 24: 3 } as const;
type ColorBits = keyof (typeof COLOR_LEVEL_MAP);

/**
 * Terminal utilities
 */
export class TerminalUtil {

  static removeAnsiSequences(output: string): string {
    return output.replace(ANSI_CODE_REGEX, '');
  }

  /**
   * Read input given term state
   */
  static async readInput({ input, output }: TermState, query: string): Promise<Buffer> {
    try {
      console.trace!('Reading input', input.isRaw, ANSICodes.DEBUG(query));
      input.setRawMode(true);
      // Send data, but do not wait on it
      output.write(query);
      await new Promise(res => input.once('readable', res));
      const val: Buffer | string = input.read();
      return typeof val === 'string' ? Buffer.from(val, 'utf8') : val;
    } finally {
      console.log!('Resolved input', input.isRaw, ANSICodes.DEBUG(query));
      input.setRawMode(false);
    }
  }

  /** Parse xterm color response */
  static parseColorResponse(response: Buffer): RGB | undefined {
    const groups = response.toString('utf8').match(COLOR_RESPONSE)?.groups ?? {};
    return 'r' in groups ? [to256(groups.r), to256(groups.g), to256(groups.b)] : undefined;
  }

  /** Parse cursor query response into {x,y} */
  static parseCursorPosition(response: Buffer): TermCoord {
    const groups = response.toString('utf8').match(POSITION_RESPONSE)?.groups ?? {};
    return { x: +(groups.c || 1) - 1, y: +(groups.r || 1) - 1 };
  }

  /**
   * Executes xterm query against the term
   */
  static oscQuery(term: TermState, field: TermColorField): Promise<RGB | undefined>;
  static oscQuery(term: TermState, field: OSCQueryField): Promise<Buffer | RGB | undefined> {
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
    const res = this.readInput(term, ANSICodes.DEVICE_STATUS_REPORT(field));
    if (field === 'cursorPosition') {
      return res.then(v => this.parseCursorPosition(v));
    }
    return res;
  }

  /**
  * Query cursor position
  */
  static getCursorPosition(term: TermState): Promise<TermCoord> {
    return this.deviceStatusReport(term, 'cursorPosition');
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
   * Detect color level from tty information
   */
  static async detectColorLevel(term: TermState): Promise<ColorLevel> {
    const force = process.env.FORCE_COLOR;
    const disable = process.env.NO_COLOR ?? process.env.NODE_DISABLE_COLORS;
    if (force !== undefined) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return Math.max(Math.min(/^\d+$/.test(force) ? parseInt(force, 10) : 1, 3), 0) as ColorLevel;
    } else if (disable !== undefined && /^(1|true|yes|on)/i.test(disable)) {
      return 0;
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return term.output.isTTY ? COLOR_LEVEL_MAP[term.output.getColorDepth() as ColorBits] : 0;
  }

  /**
   * Determines if background color is dark
   */
  static async getBackgroundScheme(term: TermState): Promise<TermBackgroundScheme | undefined> {
    const bgColor = (term.interactive ? await TerminalUtil.oscQuery(term, 'backgroundColor') : undefined) ?? this.readColorFgBgEnvVar()?.bg;
    if (bgColor) {
      const [r, g, b] = bgColor;
      return (r + g + b) / 3 < 128 ? 'dark' : 'light';
    }
  }

  /**
   * Generate a color state object
   */
  static async getColorState(level?: ColorLevel, scheme?: TermBackgroundScheme): Promise<Partial<TermColorState>> {
    // Try to detect background color, async nature means there will be a delay
    const term = { height: 0, input: process.stdin, output: process.stdout, width: 0, interactive: process.stdout.isTTY };
    level ??= await this.detectColorLevel(term);
    scheme ??= (level > 0 ? await this.getBackgroundScheme(term) : undefined);
    return { level, scheme };
  }
}