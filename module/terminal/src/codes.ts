const ESC = '\x1b[';
const OSC = '\x1b]';
const ST = '\x1b\\';

// eslint-disable-next-line no-control-regex
export const ANSI_CODE_REGEX = /(\x1b|\x1B)[\[\]][?]?[0-9;]+[A-Za-z]/g;

export const OSC_QUERY_FIELDS = {
  backgroundColor: 11,
  foregroundColor: 10
};

export type OSCQueryField = keyof (typeof OSC_QUERY_FIELDS);

export const DEVICE_STATUS_FIELDS = {
  cursorPosition: 6,
};

export type DeviceStatusField = keyof (typeof DEVICE_STATUS_FIELDS);

export const ANSICodes = {
  DEBUG: (text: string): string => text.replaceAll(ESC, '<ESC>').replaceAll(OSC, '<OSC>').replaceAll('\n', '<NL>').replaceAll(ST, '<ST>'),
  CURSOR_DY: (row: number): string => `${ESC}${Math.abs(row)}${row < 0 ? 'A' : 'B'}`,
  CURSOR_DX: (col: number): string => `${ESC}${Math.abs(col)}${col < 0 ? 'D' : 'C'}`,
  COLUMN_SET: (col: number): string => `${ESC}${col}G`,
  POSITION_SET: (row: number, col: number): string => `${ESC}${row};${col}H`,
  ERASE_SCREEN: (dir: 0 | 1 | 2 | 3 = 0): string => `${ESC}${dir}J`,
  ERASE_LINE: (dir: 0 | 1 | 2 = 0): string => `${ESC}${dir}K`,
  STYLE: (codes: (string | number)[]): string => `${ESC}${codes.join(';')}m`,
  SHOW_CURSOR: (): string => `${ESC}?25h`,
  HIDE_CURSOR: (): string => `${ESC}?25l`,
  SCROLL_RANGE_SET: (start: number, end: number): string => `${ESC}${start};${end}r`,
  SCROLL_RANGE_CLEAR: (): string => `${ESC}r`,
  SCROLL_WINDOW: (rows: number): string => `${ESC}${Math.abs(rows)}${rows < 0 ? 'S' : 'T'}`,
  POSITION_RESTORE: (): string => `${ESC}u`,
  POSITION_SAVE: (): string => `${ESC}s`,
  DEVICE_STATUS_REPORT: (code: DeviceStatusField): string => `${ESC}${DEVICE_STATUS_FIELDS[code]}n`,
  OSC_QUERY: (code: OSCQueryField): string => `${OSC}${OSC_QUERY_FIELDS[code]};?${ST}`,
};