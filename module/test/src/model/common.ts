/**
 * Core Suite definition
 */
export interface SuiteCore {
  /**
   * The class id
   */
  classId: string;
  /**
   * The tests' description
   */
  description: string;
  /**
   * It's file
   */
  file: string;
  /**
   * The lines within the file the tests overlaps
   */
  lines: { start: number, end: number };
}

/**
 * Test core definition, adds codeStart
 */
export interface TestCore extends SuiteCore {
  /**
   * The lines within the file the tests overlaps
   */
  lines: { start: number, end: number, codeStart: number };
}