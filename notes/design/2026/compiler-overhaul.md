# `@travetto/compiler` Architecture Review & Barebones `tsc` Redesign

## Goal Description

`@travetto/compiler` has been getting into inconsistent states that require running `npx trvc clean` and restarting the server. Reviewing the architecture against what `@travetto/compiler` *actually* needs on top of `tsc` shows why: the compiler currently hand-rolls its own `ts.CompilerHost` caches, file hashing, error tracking, `fs.utimes` timestamp hacks, and single-file watch loop instead of letting TypeScript's built-in incremental `BuilderProgram` (`.tsbuildinfo`) do what `tsc` is built to do.

At its core, `@travetto/compiler` only has **four responsibilities** on top of `tsc`:
1. **Load & run custom AST transformers** (`@travetto/transformer`).
2. **Rewrite output paths** into `.trv/output/node_modules/<module>` (and `.trv/types`).
3. **Update `manifest.json`** when workspace files are added or removed.
4. **Emit IPC events** (`state`, `progress`, `change`, `log`) to `CompilerServer` and connected clients.

---

## Coding Rules & Constraints (Must Follow Strictly)

1. **No identifier abbreviations**: Do not use abbreviations on new identifiers (e.g., use `context`, `index`, `module`, `diagnostic`, `previous`, `response`, `error` instead of `ctx`, `idx`, `mod`, `diag`, `prev`, `res`, `err`).
2. **Type coercion**: Never use `Boolean(...)`, `Number(...)`, or `String(...)`. Use `!!value`, `+value`, and `${value}` or `value.toString()`.
3. **Private members**: Never use TypeScript `private`, `protected`, `public`, or `override` keywords. Always use native ECMAScript `#private` fields and methods.
4. **Imports**: Include file extensions (`.ts` / `.js`) on all relative imports and use `node:` prefix for Node built-ins.
5. **Finalization**: Run `npx trv lint --fix` after all edits are complete.

---

## Architecture & Race-Free Pipeline

```mermaid
sequenceDiagram
    participant PW as @parcel/watcher (Silent Rotation)
    participant Q as AsyncQueue (Raw Events)
    participant Loop as Compiler Batch Loop
    participant Manifest as ManifestIndex & manifest.json
    participant TSC as tsc BuilderProgram (.tsbuildinfo)
    participant IPC as IPC Events (change / watch-start)

    PW->>Q: Enqueue raw { file, action } (Zero state/manifest mutation!)
    Loop->>Q: Wait for event + drain batch (coalesce 25ms)
    Loop->>IPC: 1. Send state: 'compile-start'
    Loop->>Manifest: 2. Update in-memory ManifestIndex & remove deleted outputs
    Loop->>TSC: 3. Create/update tsc BuilderProgram & run emitNextAffectedFile()
    Loop->>Manifest: 4. Atomically write updated manifest.json to disk (temp + rename)
    Loop->>IPC: 5. Send 'change' events + state: 'watch-start' (or 'compile-failed')
```

---

## Step-by-Step Proposed Changes

### 1. `@travetto/manifest` — Atomic Manifest File Writes

#### [file.ts](file:///Users/arcsine/Code/travetto/module/manifest/src/file.ts)
Replace `fs.copyFile` in `bufferedFileWrite` with an atomic write-and-rename in the target directory (falling back to `os.tmpdir()` + `copyFile` only on cross-device error):

```ts
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';

import path from './path.ts';

export class ManifestFileUtil {
  /**
   * Write file and atomically rename over when ready
   */
  static async bufferedFileWrite(file: string, content: string): Promise<void> {
    const directory = path.dirname(file);
    await fs.mkdir(directory, { recursive: true });
    const temp = path.resolve(directory, `.${path.basename(file)}.${process.pid}.${process.hrtime.bigint()}.tmp`);
    try {
      await fs.writeFile(temp, content, 'utf8');
      await fs.rename(temp, file);
    } catch {
      const fallbackTemp = path.resolve(os.tmpdir(), `${process.pid}.${process.hrtime.bigint()}.${path.basename(file)}`);
      try {
        await fs.writeFile(fallbackTemp, content, 'utf8');
        await fs.copyFile(fallbackTemp, file);
      } finally {
        await fs.rm(fallbackTemp, { force: true });
      }
    } finally {
      await fs.rm(temp, { force: true });
    }
  }

  /**
   * Read as json, sync
   */
  static readAsJsonSync<T = unknown>(file: string): T {
    return JSON.parse(readFileSync(file, 'utf8'));
  }
}
```

---

### 2. `@travetto/compiler` — Process, Server & Client Layer

#### [process-handle.ts](file:///Users/arcsine/Code/travetto/module/compiler/src/server/process-handle.ts)
Delete `module/compiler/src/server/process-handle.ts`.

#### [__index__.ts](file:///Users/arcsine/Code/travetto/module/compiler/__index__.ts)
Remove `export * from './src/server/process-handle.ts';` from `module/compiler/__index__.ts`.

#### [util.ts](file:///Users/arcsine/Code/travetto/module/compiler/src/util.ts)
Add `CompilerUtil.isProcessRunning` and `CompilerUtil.killProcess` to `module/compiler/src/util.ts`:

```ts
  /**
   * Check if a process ID is currently alive
   */
  static isProcessRunning(processId: number | undefined): boolean {
    if (!processId || processId <= 0) {
      return false;
    }
    try {
      process.kill(processId, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Terminate a process by PID and wait for it to exit
   */
  static async killProcess(processId: number | undefined, timeoutMilliseconds = 3000): Promise<boolean> {
    if (!this.isProcessRunning(processId)) {
      return false;
    }
    try {
      process.kill(processId!);
    } catch {
      return false;
    }
    const start = Date.now();
    while (this.isProcessRunning(processId) && Date.now() - start < timeoutMilliseconds) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (this.isProcessRunning(processId)) {
      try {
        process.kill(processId!, 'SIGKILL');
      } catch {}
    }
    return true;
  }
```

#### [common.ts](file:///Users/arcsine/Code/travetto/module/compiler/src/common.ts)
Update `CommonUtil.restartableEvents` so that when `shouldRestart(event)` returns `true`:
1. It calls `controller.abort()` **first**.
2. It drains/awaits the end of `stream` (`await iterator.return?.()`) so the child process in `CompilerManager.#runTarget` completely exits **before** `onRestart(event)` wipes `.trv/output` and starts the next loop iteration!

```ts
  /**
   * Restartable Event Stream
   */
  static async *restartableEvents<T>(
    input: (signal: AbortSignal) => AsyncIterable<T>,
    parent: AbortSignal,
    shouldRestart: (item: T) => boolean,
    onRestart?: (item: T) => Promise<void>
  ): AsyncIterable<T> {
    outer: while (!parent.aborted) {
      const controller = new AbortController();
      setMaxListeners(1000, controller.signal);
      const kill = (): void => controller.abort();
      parent.addEventListener('abort', kill);

      const stream = input(controller.signal);
      const iterator = stream[Symbol.asyncIterator]();

      log.debug('Started event stream');

      try {
        for (;;) {
          const next = await iterator.next();
          if (next.done) {
            break;
          }
          const event = next.value;
          yield event;
          if (shouldRestart(event)) {
            log.debug('Restarting stream');
            controller.abort();
            parent.removeEventListener('abort', kill);
            await iterator.return?.().catch(() => {});
            await onRestart?.(event);
            continue outer;
          }
        }
      } finally {
        parent.removeEventListener('abort', kill);
        if (!controller.signal.aborted) {
          controller.abort();
        }
      }

      log.debug('Finished event stream');
      return;
    }
  }
```

#### [client.ts](file:///Users/arcsine/Code/travetto/module/compiler/src/server/client.ts)
- Remove `import { ProcessHandle } from './process-handle.ts';` and `#handle`.
- Import `{ CompilerUtil } from '../util.ts';`.
- Update `stop()`:
```ts
  /** Stop server and wait for shutdown */
  async stop(): Promise<boolean> {
    const info = await this.info();
    if (!info) {
      return false;
    }

    await this.#fetch('/stop').catch(() => {});
    this.#log.debug('Waiting for compiler and server to exit');
    await Promise.all([
      CompilerUtil.killProcess(info.compilerProcessId),
      CompilerUtil.killProcess(info.serverProcessId)
    ]);
    return true;
  }
```

#### [server.ts](file:///Users/arcsine/Code/travetto/module/compiler/src/server/server.ts)
- Remove `ProcessHandle` import and `#handle`.
- Remove `await this.#handle.server.writePidFile(this.info.serverProcessId)` from `#tryListen`.
- Remove `await this.#handle.compiler.kill()` and `writePidFile` from `processEvents`.
- In `processEvents`:
  - Pass an `onRestart` callback to `CommonUtil.restartableEvents(input, this.signal, event => this.isResetEvent(event), async event => { ... })`:
  - Inside `onRestart`:
    ```ts
    if (this.isResetEvent(event)) {
      if (!event.payload.soft) {
        log.info('Reset event received, wiping compiler caches and output');
        this.info.messages = {};
        this.#ctx = getManifestContext();
        await this.#disconnectActive();
      }
      const previousProcessId = this.info.compilerProcessId;
      this.info.compilerProcessId = 0;
      await CompilerUtil.killProcess(previousProcessId, RESET_KILL_TIMEOUT_MILLISECONDS);
      await CompilerUtil.clearCaches(this.#ctx, !event.payload.soft);
    }
    ```
- In `close()`: replace `await this.#handle.compiler.kill()` with `await CompilerUtil.killProcess(this.info.compilerProcessId)`.

#### [manager.ts](file:///Users/arcsine/Code/travetto/module/compiler/src/server/manager.ts)
- In `#runTarget`:
  - Resolve the target binary path via `fileURLToPath(import.meta.resolve('@travetto/compiler/bin/trvc-target.js'))` (and in `#spawnProcess` resolve `fileURLToPath(import.meta.resolve('@travetto/compiler/bin/trvc.js'))`).
  - Set `detached: false` on `#runTarget`'s `spawn` (keep `detached: true` only on `#spawnProcess` for the background daemon).
  - Ensure `kill` waits for `subProcess` to exit before `#runTarget` finishes:
    ```ts
    const exitPromise = new Promise<void>(resolve => subProcess.once('exit', () => resolve()));
    const kill = (): void => {
      log.debug('Shutting down process');
      if (subProcess.connected) {
        subProcess.send('shutdown', () => subProcess.kill());
      } else {
        subProcess.kill();
      }
    };
    process.once('SIGINT', kill);
    signal.addEventListener('abort', kill);
    try {
      yield* queue;
    } finally {
      process.off('SIGINT', kill);
      signal.removeEventListener('abort', kill);
      if (subProcess.exitCode === null && subProcess.signalCode === null) {
        kill();
        await Promise.race([exitPromise, CommonUtil.nonBlockingTimeout(1000)]);
        if (subProcess.exitCode === null && subProcess.signalCode === null) {
          subProcess.kill('SIGKILL');
          await exitPromise;
        }
      }
    }
    ```

---

### 3. `@travetto/compiler` — Queue & Watcher Layer

#### [queue.ts](file:///Users/arcsine/Code/travetto/module/compiler/src/queue.ts)
Add `drain(): X[]` to `AsyncQueue<X>`:
```ts
  drain(): X[] {
    const items = this.#queue.splice(0, this.#queue.length);
    return items;
  }
```

#### [types.ts](file:///Users/arcsine/Code/travetto/module/compiler/src/types.ts)
- Update `CompileStateEntry`:
```ts
export type CompileStateEntry = {
  sourceFile: string;
  outputFile: string;
  module: ManifestModule;
  import: string;
  moduleFile: string;
};
export type CompilerWatchRawEvent = { action: ChangeEventType; file: string };
export type CompilerWatchEvent = { action: ChangeEventType; file: string; entry: CompileStateEntry; moduleFile: string };
```

#### [watch.ts](file:///Users/arcsine/Code/travetto/module/compiler/src/watch.ts)
Rewrite `CompilerWatcher` so that:
1. **No `.trv/canary.id` file**:
   - Replace `#listenCanary()` with `#listenWorkspaceRotation()`:
   - Every 30 seconds (`#watchRotationFrequency = 30`), if `Date.now() - this.#lastWorkspaceEventTime >= this.#watchRotationFrequency * 1000`, silently re-run `await this.#listenWorkspace()` (which subscribes the new `@parcel/watcher` instance *before* unsubscribing the old one) and run `ManifestDeltaUtil.produceDelta(this.#state.manifest)` to enqueue any files modified while `@parcel/watcher` may have been frozen.
2. **All Workspace `package.json` Files Watched**:
   - `packageFiles` includes root `package.json`, lockfiles, **and** `path.resolve(this.#root, module.sourceFolder, 'package.json')` for every workspace module (`module.workspace`).
3. **Pure Raw Event Producer + Batching (`AsyncIterable<CompilerWatchEvent[]>`)**:
   - `@parcel/watcher` callback **only** checks `packageFiles` (throwing `CompilerReset`) and queues raw `{ file, action }` into `#rawQueue: AsyncQueue<CompilerWatchRawEvent>`. It **never** mutates `CompilerState` or `ManifestIndex`!
   - Expose `processBatch(rawEvents: CompilerWatchRawEvent[]): Promise<CompilerWatchEvent[]>`:
     - Called by `Compiler` on the main loop *between* compilations!
     - Checks `isCompilerFile` -> throws `CompilerReset('Compiler source changed')`.
     - Resolves `CompileStateEntry` (`registerInput` on `'create'`, `removeSource` on `'delete'`), filters unchanged files via `this.#state.checkIfSourceChanged(entry.sourceFile)`.
     - Updates in-memory `Manifest` and `ManifestIndex` (`#updateManifestInMemory(items)`) *before* `tsc` runs, and returns the `CompilerWatchEvent[]` batch plus a `commitManifests()` function (or `writeUpdatedManifests(items)`) to write the modified `manifest.json` files atomically to disk *after* `tsc` emits `.js` files!

---

### 4. `@travetto/compiler` — `CompilerState` & `Compiler` with `tsc` Incremental `BuilderProgram`

#### [state.ts](file:///Users/arcsine/Code/travetto/module/compiler/src/state.ts)
1. **Direct Output Path Calculation (No `#tscOutputFileToOutput` or `#outputToEntry`)**:
   - In `registerInput(module: ManifestModule, moduleFile: string)`:
     ```ts
     const relativeSource = `${module.sourceFolder || '.'}/${moduleFile}`;
     const relativeOutput = `${module.outputFolder}/${moduleFile}`;
     const sourceFile = path.resolve(this.#manifest.workspace.path, relativeSource);
     const sourceFolder = path.dirname(sourceFile);
     const outputFile = path.resolve(this.#outputPath, ManifestModuleUtil.withOutputExtension(relativeOutput));

     const entry: CompileStateEntry = {
       sourceFile,
       outputFile,
       module,
       import: `${module.name}/${moduleFile}`,
       moduleFile
     };
     ```
   - Helper `#resolveEmittedFilePath(entry: CompileStateEntry, emittedPath: string): { outputLocation: string; typingsLocation?: string }`:
     - Given `entry.outputFile` (which ends in `.js`, `.d.ts`, or `.json`) and `emittedPath` from `tsc`:
     - Base path without `.js` extension: `const baseOutput = ManifestModuleUtil.withoutOutputExtension(entry.outputFile)`.
     - Determine suffix from `emittedPath`:
       - If `emittedPath.endsWith('.d.ts.map')` -> `${baseOutput}.d.ts.map`
       - Else if `emittedPath.endsWith('.d.ts')` -> `${baseOutput}.d.ts`
       - Else if `emittedPath.endsWith('.js.map')` -> `${entry.outputFile}.map`
       - Else -> `entry.outputFile`
     - If `ManifestModuleUtil.TYPINGS_WITH_MAP_EXT_REGEX.test(emittedPath)` and `TYPINGS_FOLDER_KEYS.has(ManifestModuleUtil.getFolderKey(entry.moduleFile))`, set `typingsLocation = outputLocation.replace(this.#outputPath, this.#typingsPath)`.
   - In `removeSource(sourceFile: string): boolean`:
     - Delete `sourceFile` from `#failures`, `#sourceFileObjects`, `#sourceContents`, `#sourceHashes`, `#sourceToEntry`, `#sourceFiles`.
     - If `!entry`, return `false`.
     - Compute the 4 output files (`entry.outputFile`, `${entry.outputFile}.map`, `${baseOutput}.d.ts`, `${baseOutput}.d.ts.map`) and their corresponding paths under `this.#typingsPath`, delete them via `fs.rmSync(target, { force: true })`, and return `true`.

2. **Accurate Content Hashing & Versioned `ts.SourceFile`s**:
   - In `#readFile(sourceFile)` / `readFile(sourceFile)`:
     - Whenever a file is read from disk and not in `#sourceContents`, compute `const hash = CompilerUtil.naiveHash(contents)` and store it in `#sourceHashes.set(sourceFile, hash)`.
   - In `checkIfSourceChanged(sourceFile: string): boolean`:
     ```ts
     const contents = this.#readFile(sourceFile);
     if (contents === undefined) {
       return false;
     }
     const previousHash = this.#sourceHashes.get(sourceFile);
     if (contents.length === 0 && previousHash !== undefined && previousHash >= 0) {
       return false; // Ignore transient empty file on save
     }
     const currentHash = CompilerUtil.naiveHash(contents);
     const changed = previousHash !== currentHash;
     if (changed) {
       this.#sourceHashes.set(sourceFile, currentHash);
       this.#sourceContents.set(sourceFile, contents);
       this.#sourceFileObjects.delete(sourceFile);
     }
     return changed;
     ```
   - In `getSourceFile(sourceFile, language, onError, shouldCreateNewSourceFile)`:
     ```ts
     if (shouldCreateNewSourceFile) {
       this.#sourceFileObjects.delete(sourceFile);
     }
     return this.#sourceFileObjects.getOrInsertComputed(sourceFile, () => {
       const content = this.readFile(sourceFile) ?? '';
       const hash = this.#sourceHashes.get(sourceFile) ?? CompilerUtil.naiveHash(content);
       this.#sourceHashes.set(sourceFile, hash);
       const sourceFileObject = ts.createSourceFile(sourceFile, content, language);
       (sourceFileObject as { version?: string }).version = `${hash}`;
       return sourceFileObject;
     });
     ```

3. **`tsc` Incremental `BuilderProgram` with `.d.ts` Signature Dependent Tracking**:
   - Why `BuilderProgram` is used:
     - Maintain `#builderProgram?: ts.EmitAndSemanticDiagnosticsBuilderProgram`.
     - In `#initCompilerOptions()`, include:
       ```ts
       incremental: true,
       tsBuildInfoFile: path.resolve(this.#outputPath, '.tsbuildinfo')
       ```
     - Add `getBuilderProgram(force = false): Promise<ts.EmitAndSemanticDiagnosticsBuilderProgram>`:
       - Calls `await this.initializeTypescript()`.
       - On first call (`!this.#builderProgram`), if `ts.sys.fileExists(this.#compilerOptions.tsBuildInfoFile!)`, loads `const oldProgram = ts.readBuilderProgram(this.#compilerOptions, this)`.
       - Creates `this.#builderProgram = ts.createEmitAndSemanticDiagnosticsBuilderProgram(this.#getTypeScriptFiles(), this.#compilerOptions, this, this.#builderProgram ?? oldProgram)`.
       - Initializes transformers: `this.#transformerManager.init(this.#builderProgram.getProgram().getTypeChecker())`.
       - **Crucial `.d.ts` signature hook**: Wrap `const program = this.#builderProgram.getProgram(); const originalEmit = program.emit.bind(program);` so `program.emit` injects `this.#transformerManager.get()` when `customTransformers` is not passed, and wraps `originalEmit` in `try/catch` to convert any thrown transformer error into a `ts.Diagnostic` on `targetSourceFile`!
         - Because `BuilderProgram.emitNextAffectedFile` calls `state.program.emit` with `customTransformers = undefined`, `BuilderProgram` executes its native `computeSignatureWithDiagnostics` on the emitted `.d.ts` text (`typescript.js:132404`) and **automatically queues importing files if and only if the `.d.ts` declaration signature changed**!
   - Add `compileAffectedFiles(changedFiles: string[]): AsyncGenerator<{ sourceFile: string; diagnostics: CompilerDiagnosticItem[]; duration: number }>`:
     - Initialize a compilation `queue` with `changedFiles` and any existing failed files (`this.#failures.keys()`) so fixed diagnostics are resolved immediately.
     - Maintain `#fileToDependencies` and `#fileToImporters` reverse dependency maps.
     - For non-TS files (`package-json`, `js`, `typings`), compile directly via `compileSourceFile(file)` and yield.
     - For TS files: compile via `compileSourceFile(file, needsNewProgram, dtsChangeRef)` (reusing the ASTs from `oldProgram: this.#program`).
     - If `dtsChangeRef.changed` is true (i.e. the public interface/types of the emitted `.d.ts` actually changed), look up dependent workspace files via `#fileToImporters.get(file)` and add them to `queue`. If only function bodies or private implementations changed without affecting `.d.ts`, zero dependent files are recompiled.
     - This eliminates the multi-second full-program emit iteration and delivers sub-150ms incremental recompilation in watch mode.

#### [compiler.ts](file:///Users/arcsine/Code/travetto/module/compiler/src/compiler.ts)
1. **Initial Build (`run()`)**:
   - Remove deleted files (`deleteEvents`).
   - Emit changed files using `this.emit(changedFiles)` (which delegates to `this.#state.compileAffectedFiles(changedFiles)` and emits `progress` and `log` error events).
   - Remove the `await fs.utimes(file, new Date(), new Date())` hack on source `.ts` files.
   - Always write manifests (`writeManifest` and `writeDependentManifests`) when `changedFiles.length > 0 || deleteEvents.length > 0` or if the root manifest doesn't exist yet on disk.
   - Remove `const resolved = this.#state.getArbitraryInputFile(); await this.#state.compileSourceFile(resolved);` before watch mode (since `BuilderProgram` is already warm or initialized via `await this.#state.getBuilderProgram()`).
2. **Watch Mode (`#onWatchBatch(rawEvents: CompilerWatchRawEvent[])`)**:
   - When `this.#watcher` yields a batch of raw events:
     1. Call `const events = await this.#watcher.prepareBatch(rawEvents)` (which checks `isCompilerFile`, updates `CompilerState` entries and in-memory `ManifestIndex`, and filters out unchanged files). If `events.length === 0`, return without emitting state churn!
     2. Send `this.#sendEvent('state', { state: 'compile-start' })`.
     3. Handle any `'delete'` events (`removeSource` + log).
     4. Call `this.#state.compileAffectedFiles(createOrUpdateFiles)` to compile the modified files + any `tsc`-determined affected importers + recheck any previously failed files.
     5. Call `await this.#watcher.writeBatchManifests(events)` so `manifest.json` is written atomically to disk *after* `.js` files are emitted and *before* `change` / `watch-start` events are sent!
     6. Send `change` events for all successfully compiled/deleted files in the batch, and send `this.#sendEvent('state', { state: this.#state.hasErrors() ? 'compile-failed' : 'watch-start' })` once at the end of the batch!

---

## Verification Plan

### Automated Tests
1. Run unit tests for `@travetto/manifest` and `@travetto/compiler`:
   ```bash
   npx trv test module/manifest
   npx trv test module/compiler
   ```
2. Update and expand [module/compiler/test/state.ts](file:///Users/arcsine/Code/travetto/module/compiler/test/state.ts) and [module/compiler/test/server.ts](file:///Users/arcsine/Code/travetto/module/compiler/test/server.ts) to test:
   - `removeSource` deleting both `.trv/output` and `.trv/types` files.
   - `checkIfSourceChanged` and `AsyncQueue.drain()`.
   - Incremental `BuilderProgram` compilation (`compileAffectedFiles`) propagating `.d.ts` signature changes to importing files while skipping importers when only internal function bodies change.
   - `CompilerServer` reset and `/clean` handling without `ProcessHandle` / `.pid` files.
3. Run the linter auto-fix across the repository:
   ```bash
   npx trv lint --fix
   ```
