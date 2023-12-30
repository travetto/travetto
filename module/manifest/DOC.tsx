/** @jsxImportSource @travetto/doc */
import { readFileSync } from 'node:fs';

import { d, c } from '@travetto/doc';
import { ManifestRoot, path, RuntimeIndex } from '@travetto/manifest';
import { COMMON_DATE } from '@travetto/doc/src/util/run';

const RuntimeIndexRef = d.codeLink('RuntimeIndex', 'src/runtime.ts', /class .*RuntimeIndex/);
const DeltaRef = d.codeLink('ManifestDeltaUtil', 'src/delta.ts', /class ManifestDeltaUtil/);


const manifest = () => {
  const obj: ManifestRoot = JSON.parse(readFileSync(path.resolve(RuntimeIndex.getModule('@travetto/manifest')!.outputPath, 'manifest.json'), 'utf8'));
  const modules = Object.fromEntries(Object.entries(obj.modules).filter(([k]) => k === '@travetto/manifest'));
  // @ts-expect-error
  delete obj.modules;
  obj.workspace.path = '<generated>';
  obj.generated = COMMON_DATE;
  obj.main.version = 'x.x.x';
  for (const md of Object.values(modules)) {
    md.version = 'x.x.x';
    for (const files of Object.values(md.files)) {
      for (const file of files) {
        file[2] = COMMON_DATE;
      }
    }
  }
  return JSON.stringify({ ...obj, modules }, null, 2).replace(/\[[^[]*?\]/gsm, v => v.replace(/\s+/gs, ' '));
};

export const text = <>
  <c.StdHeader />
  This module aims to be the boundary between the file system and the code.  The module provides:

  <ul>
    <li>Project Manifesting</li>
    <li>Manifest Delta</li>
    <li>Class and Function Metadata</li>
    <li>Runtime Indexing</li>
    <li>Path Normalization</li>
  </ul>

  <c.Section title='Project Manifesting'>
    The project manifest fulfills two main goals: Compile-time Support, and Runtime Knowledge of the project.

    <c.SubSection title='Compile-time Support'>
      During the compilation process, the compiler needs to know every file that is eligible for compilation, when the file was last created/modified, and any specific patterns for interacting with a given file (e.g. transformers vs. testing code vs. support files that happen to share a common extension with code).
    </c.SubSection>

    <c.SubSection title='Runtime Knowledge'>
      Additionally, once the code has been compiled (or even bundled after that), the executing process needs to know what files are available for loading, and any patterns necessary for knowing which files to load versus which ones to ignore. This allows for dynamic loading of modules/files without knowledge/access to the file system, and in a more performant manner.
    </c.SubSection>
  </c.Section>

  <c.Section title='Manifest Delta'>
    During the compilation process, it is helpful to know how the output content differs from the manifest, which is produced from the source input. The {DeltaRef} provides the functionality for a given manifest, and will produce a stream of changes grouped by module.  This is the primary input into the {d.mod('Compiler')}'s incremental behavior to know when a file has changed and needs to be recompiled.
  </c.Section>
  <c.Section title='Class and Function Metadata'>

    For the framework to work properly, metadata needs to be collected about files, classes and functions to uniquely identify them, with support for detecting changes during live reloads.  To achieve this, every {d.input('class')} is decorated with an additional field of {d.input('Ⲑid')}.  {d.input('Ⲑid')} represents a computed id that is tied to the file/class combination. <br />

    {d.input('Ⲑid')} is used heavily throughout the framework for determining which classes are owned by the framework, and being able to lookup the needed data from the {RuntimeIndexRef} using the {d.method('getFunctionMetadata')} method.

    <c.Code title='Test Class' src='./doc/test-class.ts' />

    <c.Code title='Test Class Compiled' src={RuntimeIndex.getFromImport('@travetto/manifest/doc/test-class')!.outputFile} />

    <c.Execution title='Index Lookup at Runtime' cmd='trv' args={['main', './doc/lookup.ts']} />
  </c.Section>
  <c.Section title='Module Indexing'>
    Once the manifest is created, the application runtime can now read this manifest, which allows for influencing runtime behavior. The most common patterns include:
    <ul>
      <li>Loading all source files</li>
      <li>Iterating over every test file</li>
      <li>Finding all source folders for watching</li>
      <li>Find all output folders for watching</li>
      <li>Determining if a module is available or not</li>
      <li>Resource scanning</li>
      <li>Providing contextual information when provided a filename, import name, etc (e.g. logging, testing output)</li>
    </ul>
  </c.Section>
  <c.Section title='Path Normalization' >
    By default, all paths within the framework are assumed to be in a POSIX style, and all input paths are converted to the POSIX style.  This works appropriately within a Unix and a Windows environment.  This module offers up <c.CodeLink title='path' src='./src/path.ts' startRe={/export/} /> as an equivalent to {d.library('Node')}'s {d.library('Path')} library.  This allows for consistent behavior across all file-interactions, and also allows for easy analysis if {d.library('Node')}'s {d.library('Path')} library is ever imported.
  </c.Section>
  <c.Section title='Anatomy of a Manifest'>

    <c.Code title='Manifest for @travetto/manifest' src={manifest()} />

    <c.SubSection title='General Context'>
      The general context describes the project-space and any important information for how to build/execute the code. <br />

      The context contains:
      <ul>
        <li>A generated timestamp</li>
        <li>Module Type: {d.input('commonjs')}({d.library('CommonJS')}) or {d.input('module')}({d.library('EcmascriptModule')})</li>
        <li>The main module to execute. (<em>This primarily pertains to mono-repo support when there are multiple modules in the project</em>)</li>
        <li>The root path of the project/workspace</li>
        <li>
          Whether or not the project is a mono-repo. (<em>This is determined by using the 'workspaces' field in your {d.library('PackageJson')}</em>)</li>
        <li>
          The location where all compiled code will be stored.  Defaults to: {d.path('.trv_output')}. (<em>Can be overridden in your {d.library('PackageJson')} in 'travetto.outputFolder'</em>)
        </li>
        <li>The location where the intermediate compiler will be created. Defaults to: {d.path('.trv_compiler')}</li>
        <li>The location where tooling will be able to write to. Defaults to: {d.path('.trv_output')}</li>
        <li>Which package manager is in use {d.library('Npm')} or {d.library('Yarn')}</li>
        <li>The main module version</li>
        <li>The main module description</li>
        <li>The framework version (based on @travetto/manifest)</li>
      </ul>
    </c.SubSection>
    <c.SubSection title='Modules'>
      The modules represent all of the {d.library('Travetto')}-aware dependencies (including dev dependencies) used for compiling, testing and executing.  A prod-only version is produced when packaging the final output.

      Each module contains:
      <ul>
        <li>The dependency npm name</li>
        <li>The dependency version</li>
        <li>A flag to determine if its a local module</li>
        <li>A flag to determine if the module is public (could be published to npm)</li>
        <li>The path to the source folder, relative to the workspace root</li>
        <li>The path to the output folder, relative to the workspace output root</li>
        <li>The list of all files</li>
        <li>The profiles a module applies to.  Values are std, test, compile, doc.  Any empty value implies std</li>
        <li>Parent modules that imported this module</li>
      </ul>
    </c.SubSection>
    <c.SubSection title='Module Files'>
      The module files are a simple categorization of files into a predetermined set of folders:
      <ul>
        <li>{d.path('$root')} - All uncategorized files at the module root</li>
        <li>{d.path('$index')} - {d.path('__index__.ts')}, {d.path('index.ts')} files at the root of the project</li>
        <li>{d.path('$package')} - The {d.library('PackageJson')} for the project</li>
        <li>{d.path('src')} - Code that should be automatically loaded at runtime. All .ts files under the {d.path('src/')} folder</li>
        <li>{d.path('test')} - Code that contains test files. All .ts files under the {d.path('test/')} folder</li>
        <li>{d.path('test/fixtures')} - Test resource files, pertains to the main module only. Located under {d.path('test/fixtures/')}</li>
        <li>{d.path('resources')} - Packaged resource, meant to pertain to the main module only. Files, under {d.path('resources/')}</li>
        <li>{d.path('support')} - All .ts files under the {d.path('support/')} folder</li>
        <li>{d.path('support/resources')} - Packaged resource files, meant to be included by other modules, under {d.path('support/resources/')}</li>
        <li>{d.path('support/fixtures')} - Test resources meant to shared across modules.  Under {d.path('support/fixtures/')}</li>
        <li>{d.path('doc')} - Documentation files. {d.path('DOC.tsx')} and All .ts/.tsx files under the {d.path('doc/')} folder</li>
        <li>{d.path('$transformer')} - All .ts files under the pattern {d.path('support/transform*')}.  These are used during compilation and never at runtime</li>
        <li>{d.path('bin')} - Entry point .js files.  All .js files under the {d.path('bin/')} folder</li>
      </ul>

      Within each file there is a pattern of either a 3 or 4 element array:

      <c.Code title='Sample file' src={`[
  "test/path.ts", // The module relative source path
  "ts", // The file type ts, js, package-json, typings, md, json, unknown
  1676751649201.1897, // Stat timestamp
  "test" // Optional profile
]`} />
    </c.SubSection>
  </c.Section>
</>;