import type { ColorLevel } from './style.ts';

declare module '@travetto/runtime' {
  interface EnvData {
    /**
     * Flag for node to disable colors
     */
    NODE_DISABLE_COLORS: boolean;
    /** 
     * Terminal colors provided as ansi 256 color schemes
     */
    COLORFGBG: string;
    /** 
     * Enables color, even if `tty` is not available 
     * @default undefined
     */
    FORCE_COLOR: boolean | ColorLevel;
    /** 
     * Disables color even if `tty` is available
     * @default false
     */
    NO_COLOR: boolean;
    /**
     * Determines terminal color level
     */
    COLORTERM: string;
    /**
     * Terminal operation mode, false means simple output
     */
    TRV_QUIET: boolean;
  }
}