import { readFileSync } from 'fs';

import { d, lib } from '@travetto/doc';
import { ManifestRoot, path, RootIndex } from '@travetto/manifest';
import { COMMON_DATE } from '@travetto/doc/src/util/run';

const manifest = () => {
  const obj: ManifestRoot = JSON.parse(readFileSync(path.resolve(RootIndex.getModule('@travetto/manifest')!.outputPath, 'manifest.json'), 'utf8'));
  const modules = Object.fromEntries(Object.entries(obj.modules).filter(([k]) => k === '@travetto/manifest'));
  // @ts-expect-error
  delete obj.modules;
  obj.workspacePath = '<generated>';
  obj.generated = COMMON_DATE;
  for (const mod of Object.values(modules)) {
    for (const files of Object.values(mod.files)) {
      for (const file of files) {
        file[2] = COMMON_DATE;
      }
    }
  }
  return JSON.stringify({ ...obj, modules }, null, 2);
};

export const text = () => d`
${d.Header()}

This module aims to be the boundary between the file system and the code.  The module provides:

${d.List(
  'Project Manifesting',
  'Runtime Indexing',
  'Path Normalization',
  'File Watching'
)}

${d.Section('Project Manifesting')}
The project manifest fulfills two main goals: Compile-time Support, and Runtime Knowledge of the project.

${d.SubSection('Compile-time Support')}
During the compilation process, the compiler needs to know every file that is eligible for compilation, when the file was last created/modified, and any specific patterns for interacting with a given file (e.g. transformers vs. testing code vs. support files that happen to share a common extension with code). 

${d.SubSection('Runtime Knowledge')}
Additionally, once the code has been compiled (or even bundled after that), the executing process needs to know what files are available for loading, and any patterns necessary for knowing which files to load versus which ones to ignore. This allows for dynamic loading of modules/files without knowledge/access to the file system, and in a more performant manner.

${d.Section('Anatomy of a Manifest')}

${d.Code('Manifest for @travetto/manifest', manifest())}

${d.SubSection('General Context')}
The general context describes the project-space and any important information for how to build/execute the code.

The context contains:
${d.List(
  'A generated timestamp',
  d`Module Type: ${d.Library('commonjs', lib.CommonJS.link)} or ${d.Library('module', lib.EcmascriptModule.link)}`,
  d`The main module to execute. ${d.Note('This primarily pertains to mono-repo support when there are multiple modules in the project')}`,
  'The root path of the project/workspace',
  d`Whether or not the project is a mono-repo. ${d.Note(`This is determined by using the 'workspaces' field in your ${lib.PackageJson}`)}`,
  d`The location where all compiled code will be stored.  Defaults to: ${d.Path('.trv_output')}.  ${d.Note(`Can be overridden in your ${lib.PackageJson} in 'travetto.outputFolder'`)}`,
  d`The location where the intermediate compiler will be created. Defaults to: ${d.Path('.trv_compiler')}`,
  d`The location where tooling will be able to write to. Defaults to: ${d.Path('.trv_output')}`,
  d`Which package manager is in use ${lib.Npm} or ${lib.Yarn}`
)}

${d.SubSection('Modules')}
The modules represent all of the ${lib.Travetto}-aware dependencies (including dev dependencies) used for compiling, testing and executing.  A prod-only version is produced when packaging the final output.

Each module contains:
${d.List(
  'The dependency npm name',
  'The dependency version',
  'A flag to determine if its a local module',
  'A flag to determine if the module is public (could be published to npm)',
  'The path to the source folder, relative to the workspace root',
  'The path to the output folder, relative to the workspace output root',
  'The list of all files',
  'The profiles a module applies to.  Values are std, test, compile, doc.  Any empty value implies std',
  'Parent modules that imported this module',
)}

${d.SubSection('Module Files')}
The module files are a simple categorization of files into a predetermined set of folders:
${d.List(
  '$root - All uncategorized files at the module root',
  '$index - __index__.ts, index.ts files at the root of the project',
  d`$package - The ${lib.PackageJson} for the project`,
  'src - Code that should be automatically loaded at runtime. All .ts files under the src/ folder',
  'test - Code that contains test files. All .ts files under the test/ folder',
  'test/fixtures - Test resource files, pertains to the main module only. Located under test/fixtures/',
  'resources - Packaged resource, meant to pertain to the main module only. Files, under resources/',
  'support - All .ts files under the support/ folder',
  'support/resources - Packaged resource files, meant to be included by other modules, under support/resources/',
  'support/fixtures - Test resources meant to shared across modules.  Under support/fixtures/',
  'doc - Documentation files. All .ts files under the doc/ folder',
  '$transformer - All .ts files under the pattern support/transform*.  These are used during compilation and never at runtime',
  'bin - Entry point .js files.  All .js files under the bin/ folder'
)}

Within each file there is a pattern of either a 3 or 4 element array:

${d.Code('Sample file', `
[
  "test/path.ts", // The module relative source path
  "ts", // The file type ts, js, package-json, typings, md, json, unknown
  1676751649201.1897, // Stat timestamp
  "test" // Optional profile
]`)}

${d.Section('Module Indexing')}
Once the manifest is created, the application runtime can now read this manifest, which allows for influencing runtime behavior. The most common patterns include:
${d.List(
  'Loading all source files',
  'Iterating over every test file',
  'Finding all source folders for watching',
  'Find all output folders for watching',
  'Determining if a module is available or not',
  'Resource scanning',
  'Providing contextual information when provided a filename, import name, etc (e.g. logging, testing output)'
)}
`;