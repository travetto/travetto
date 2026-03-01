/** Configuration of a skip */
export type Skip = boolean | ((instance: unknown) => boolean | Promise<boolean>);

/**
 * Core Suite definition
 */
export interface SuiteCore {
  /**
   * The class id
   */
  classId: string;
  /**
   * The import location for the suite
   */
  import: string;
  /**
   * The first line of the unit
   */
  lineStart: number;
  /**
   * The last line of the unit
   */
  lineEnd: number;
  /**
   * Tags for a suite or a test
   */
  tags?: string[];
  /**
   * Description
   */
  description?: string;
  /**
   * Hash of the suite/test source code
   */
  sourceHash?: number;
}

/**
 * Test core definition, adds start of body
 */
export interface TestCore extends SuiteCore {
  /**
   * The first line of the unit body
   */
  lineBodyStart: number;
  /**
   * For extended suites, this is where the test is declared
   */
  declarationImport?: string;
}