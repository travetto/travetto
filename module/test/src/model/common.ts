/** Configuration of a skip */
export type Skip = boolean | ((instance: unknown) => boolean | Promise<boolean>) | (() => boolean | Promise<boolean>);

/**
 * Core Suite definition
 */
export interface SuiteCore {
  /**
   * The module the test is declared in
   */
  module: string;
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
   * The first line of the unit
   */
  lineStart: number;
  /**
   * The last line of the unit
   */
  lineEnd: number;
}

/**
 * Test core definition, adds start of body
 */
export interface TestCore extends SuiteCore {
  /**
   * The first line of the unit body
   */
  lineBodyStart: number;
}