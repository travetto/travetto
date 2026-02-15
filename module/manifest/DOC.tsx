/** @jsxImportSource @travetto/doc/support */
import path from 'node:path';
import fs from 'node:fs/promises';

import { d, c, COMMON_DATE } from '@travetto/doc';
import { ManifestDeltaUtil, PACKAGE_MANAGERS, type ManifestRoot } from '@travetto/manifest';
import { JSONUtil, RuntimeIndex } from '@travetto/runtime';

const PACKAGE_MANAGER_LIST = PACKAGE_MANAGERS.map((manager, i) => i === 0 ? [d.library(manager.title)] : ['/', d.library(manager.title)]);

const DeltaRef = d.codeLink(ManifestDeltaUtil.name, 'src/delta.ts', new RegExp(`class ${ManifestDeltaUtil.name}`));

const manifest = async () => {
  const manifestFile = path.resolve(RuntimeIndex.getModule('@travetto/manifest')!.outputPath, 'manifest.json');
  const bytes = await fs.readFile(manifestFile);
  const result: Partial<Pick<ManifestRoot, 'modules'>> & Omit<ManifestRoot, 'modules'> = JSONUtil.fromBinaryArray(bytes);
  const modules = Object.fromEntries(Object.entries(result.modules!).filter(([key]) => key === '@travetto/manifest'));
  delete result.modules;
  result.workspace.path = '<generated>';
  result.generated = COMMON_DATE;
  result.main.version = 'x.x.x';
  for (const md of Object.values(modules)) {
    md.version = 'x.x.x';
    for (const files of Object.values(md.files)) {
      for (const file of files) {
        file[2] = COMMON_DATE;
      }
    }
  }
  return JSON.stringify({ ...result, modules }, null, 2).replace(/\[[^[]*?\]/gsm, value => value.replace(/\s+/gs, ' '));
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
    During the compilation process, it is helpful to know how the output content differs from the manifest, which is produced from the source input. The {DeltaRef} provides the functionality for a given manifest, and will produce a stream of changes grouped by module.  This is the primary input into the {d.module('Compiler')}'s incremental behavior to know when a file has changed and needs to be recompiled.
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
    By default, all paths within the framework are assumed to be in a POSIX style, and all input paths are converted to the POSIX style.  This works appropriately within a Unix and a Windows environment.  This module offers up <c.CodeLink title='path' src='./src/path.ts' startRe={/export/} /> as an equivalent to {d.library('Node')}'s {d.library('NodePath')} library.  This allows for consistent behavior across all file-interactions.
  </c.Section>
  <c.Section title='Anatomy of a Manifest'>

    <c.Code title='Manifest for @travetto/manifest' src={manifest()} />

    <c.SubSection title='General Context'>
      The general context describes the project-space and any important information for how to build/execute the code. <br />

      The context contains:
      <ul>
        <li>A generated timestamp</li>
        <li>The main module to execute. (<em>This primarily pertains to mono-repo support when there are multiple modules in the project</em>)</li>
        <li>The root path of the project/workspace</li>
        <li>
          Whether or not the project is a mono-repo. (<em>This is determined by using the 'workspaces' field in your {d.library('PackageJson')}</em>)</li>
        <li>
          The location where all compiled code will be stored.  Defaults to: {d.path('.trv_output')}. (<em>Can be overridden in your {d.library('PackageJson')} in 'travetto.outputFolder'</em>)
        </li>
        <li>The location where the intermediate compiler will be created. Defaults to: {d.path('.trv_compiler')}</li>
        <li>The location where tooling will be able to write to. Defaults to: {d.path('.trv_output')}</li>
        <li>Which package manager is in use {PACKAGE_MANAGER_LIST}</li>
        <li>The main module version</li>
        <li>The main module description</li>
        <li>The framework version (based on @travetto/manifest)</li>
      </ul>
    </c.SubSection>
    <c.SubSection title='Modules'>
      The modules represent all of the {d.library('Travetto')}-aware dependencies (including dev dependencies) used for compiling, testing and executing.  A production-only version is produced when packaging the final output.

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