declare namespace Transpile {
  /**
   * Writes a package json file
   */
  function writePackageJson(ctx: CompileContext, inputFile: string, outputFile: string, transform?: (pkg: Pkg) => Pkg): Promise<void>;

  /**
   * Transpiles a file
   */
  function transpileFile(ctx: CompileContext, inputFile: string, outputFile: string): Promise<void>;

  /**
   * Write js file
   */
  function writeJsFile(ctx: CompileContext, inputFile: string, outputFile: string): Promise<void>;

  /**
   * Get Context for building
   */
  function getContext(op?: CompileContext['op']): Promise<CompileContext>;

  type CompileContext = {
    cwd: string;
    compiled: boolean;
    outputFolder: string;
    compilerFolder: string;
    op: 'build' | 'watch' | 'clean';
    main: string;
  };

  type Pkg = {
    name: string;
    type: string;
    files: string[];
    main: string;
  };
}

export = Transpile;