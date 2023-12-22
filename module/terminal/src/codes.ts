const ESC = '\x1b[';

export const ANSICodes = {
  DEBUG: (text: string): string => text.replaceAll(ESC, '<ESC>').replaceAll('\n', '<NL>'),
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
  SOFT_RESET_CODES: (): string => `${ESC}!p`
};