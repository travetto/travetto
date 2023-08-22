/** @jsxImportSource @travetto/doc */
import { c, d } from '@travetto/doc';
import { ExecUtil, AppError, StreamUtil, ObjectUtil, DataUtil, Util, Env, FileResourceProvider, TimeUtil, FileQueryProvider } from '@travetto/base';
import { RootIndex } from '@travetto/manifest';

const ConsoleManager = d.codeLink('ConsoleManager', 'src/console.ts', /(class|function)\s*[$]ConsoleManager/);
const GlobalEnv = d.codeLink('GlobalEnv', 'src/global-env.ts', /export/);
const ResourceProvider = d.codeLink('ResourceProvider', 'src/resource.ts', /interface ResourceProvider/);

export const text = <>
  <c.StdHeader />

  Base is the foundation of all {d.library('Travetto')} applications.  It is intended to be a minimal application set, as well as support for commonly shared functionality. It has support for the following key areas:

  <ul>
    <li>Environment Support</li>
    <li>Shared Global Environment State</li>
    <li>Console Management</li>
    <li>Resource Access</li>
    <li>Standard Error Support</li>
    <li>Stream Utilities</li>
    <li>Object Utilities</li>
    <li>Data Utilities</li>
    <li>Common Utilities</li>
    <li>Time Utilities</li>
    <li>Process Execution</li>
    <li>Shutdown Management</li>
  </ul>

  <c.Section title='Environment Support'>
    The functionality we support for testing and retrieving environment information:
    <ul>
      <li>{d.method('isTrue(key: string): boolean;')} - Test whether or not an environment flag is set and is true</li>
      <li>{d.method('isFalse(key: string): boolean;')} - Test whether or not an environment flag is set and is false</li>
      <li>{d.method('isSet(key:string): boolean;')} - Test whether or not an environment value is set (excludes: {d.input('null')}, {d.input("''")}, and {d.input('undefined')})</li>
      <li>{d.method('get(key: string, def?: string): string;')} - Retrieve an environmental value with a potential default</li>
      <li>{d.method('getBoolean(key: string, isValue?: boolean)')} - Retrieve an environmental value as a boolean.  If isValue is provided, determine if the environment variable matches the specified value</li>
      <li>{d.method('getInt(key: string, def?: number): number;')} - Retrieve an environmental value as a number</li>
      <li>{d.method('getList(key: string): string[];')} - Retrieve an environmental value as a list</li>
    </ul>
  </c.Section>

  <c.Section title='Shared Global Environment State'>
    {GlobalEnv} is a non-cached interface to the {Env} class with specific patterns defined.  It provides access to common patterns used at runtime within the framework.

    <c.Code title='GlobalEnv Shape' src='@travetto/base/src/global-env.ts' startRe={/export/} endRe={/^[}] as const/} outline={true} />

    The source for each field is:

    <ul>
      <li>{d.field('envName')} - This is derived from {d.field('process.env.TRV_ENV')} with a fallback of {d.field('process.NODE_ENV')}</li>
      <li>{d.field('devMode')} - This is true if {d.field('process.env.NODE_ENV')} is dev* or test</li>
      <li>{d.field('dynamic')} - This is derived from {d.field('process.env.TRV_DYNAMIC')}. This field reflects certain feature sets used throughout the framework.</li>
      <li>{d.field('profiles')} - This is a list derived from {d.field('process.env.TRV_PROFILES')}.  This can be checked at runtime to see if specific profiles are met.  This primarily used in the framework to determine if the test profile is activated.</li>
      <li>{d.field('resourcePaths')} - This is a list derived from {d.field('process.env.TRV_RESOURCES')}.  This points to a list of folders that the {FileResourceProvider} will search against, by default.</li>
      <li>{d.field('test')} - This is true if {d.field('profiles')} includes a value of {d.input('test')}</li>
      <li>{d.field('nodeVersion')} - This is derived from {d.field('process.version')}, and is used primarily for logging purposes</li>
    </ul>

    In addition to reading these values, there is a defined method for setting/updating these values:

    <c.Code title='GlobalEnv Update' src='@travetto/base/src/global-env.ts' startRe={/export function defineGlobal/} endRe={/^[}]/} />

    As you can see this method exists to update/change the {d.field('process.env')} values so that the usage of {GlobalEnv} reflects these changes.  This is primarily used in testing, or custom environment setups (e.g. CLI invocations for specific applications).
  </c.Section>

  <c.Section title='Resource Access'>
    The primary access patterns for resources, is to directly request a file, and to resolve that file either via file-system look up or leveraging the {d.mod('Manifest')}'s data for what resources were found at manifesting time.

    <c.Code title='ResourceProvider contract' src='src/resource.ts' startRe={/interface ResourceProvider/} endRe={/^[}]/} />

    The {ResourceProvider} allows for accessing information about the resources, and subsequently reading the file as text/binary or to access the resource as a <c.Class name='Readable' /> stream.  If a file is not found, it will throw an {AppError} with a category of 'notfound'.  This contract is fairly simple to fill out, and the predominant implementation is {FileResourceProvider}.  This {ResourceProvider} will utilize the {GlobalEnv}'s {d.field('resourcePaths')} information on where to attempt to find a requested resource.

    <c.SubSection title='Scanning for Resources'>
      Beyond directly asking for a resource, there a times where it is helpful to know what resources are available at runtime. This is primarily used during development, and is a discouraged pattern for production as assumptions about the file-system may be incorrect (or change without warning).<br />

      To that end, {FileQueryProvider} exists, and is a valid {ResourceProvider}.  It also provides the {d.method('query')} method, to allow for scanning/finding resources that match certain patterns.  Additionally, this class also allows for watching all the resource folders.  This again is helpful during development/compilation, but should not be used in production.
    </c.SubSection>
  </c.Section>

  <c.Section title='Standard Error Support'>

    While the framework is 100 % compatible with standard {d.input('Error')} instances, there are cases in which additional functionality is desired. Within the framework we use {AppError} (or its derivatives) to represent framework errors. This class is available for use in your own projects. Some of the additional benefits of using this class is enhanced error reporting, as well as better integration with other modules (e.g. the {d.mod('Rest')} module and HTTP status codes). <br />

    The {AppError} takes in a message, and an optional payload and / or error classification. The currently supported error classifications are:
    <ul>
      <li>{d.input('general')} - General purpose errors</li>
      <li>{d.input('system')} - Synonym for {d.input('general')}</li>
      <li>{d.input('data')} - Data format, content, etc are incorrect. Generally correlated to bad input.</li>
      <li>{d.input('permission')} - Operation failed due to lack of permissions</li>
      <li>{d.input('auth')} - Operation failed due to lack of authentication</li>
      <li>{d.input('missing')} - Resource was not found when requested</li>
      <li>{d.input('timeout')} - Operation did not finish in a timely manner</li>
      <li>{d.input('unavailable')} - Resource was unresponsive</li>
    </ul>
  </c.Section>

  <c.Section title='Console Management'>
    This module provides logging functionality, built upon {d.library('Console')} operations. <br />

    The supported operations are:
    <ul>
      <li>{d.method('console.error')} which logs at the {d.input('ERROR')} level</li>
      <li>{d.method('console.warn')} which logs at the {d.input('WARN')} level</li>
      <li>{d.method('console.info')} which logs at the {d.input('INFO')} level</li>
      <li>{d.method('console.debug')} which logs at the {d.input('DEBUG')} level</li>
      <li>{d.method('console.log')} which logs at the {d.input('INFO')} level</li>
    </ul>

    <c.Note>
      All other console methods are excluded, specifically {d.method('trace')}, {d.method('inspect')}, {d.method('dir')}, {d.method('time')}/{d.method('timeEnd')}
    </c.Note>
  </c.Section>

  <c.Section title='How Logging is Instrumented'>

    All of the logging instrumentation occurs at transpilation time.  All {d.method('console.*')} methods are replaced with a call to a globally defined variable that delegates to the {ConsoleManager}.  This module, hooks into the {ConsoleManager} and receives all logging events from all files compiled by the {d.library('Travetto')}. <br />

    A sample of the instrumentation would be:

    <c.Code title='Sample logging at various levels' src='doc/transpile.ts' />

    <c.Code title='Sample After Transpilation' src={RootIndex.resolveFileImport('@travetto/base/doc/transpile.ts')} language='javascript' />

    <c.SubSection title='Filtering Debug'>

      The {d.input('debug')} messages can be filtered using the patterns from the {d.library('Debug')}.  You can specify wild cards to only {d.input('DEBUG')} specific modules, folders or files.  You can specify multiple, and you can also add negations to exclude specific packages.

      <c.Terminal title='Sample environment flags' src={`
# Debug
$ DEBUG=-@travetto/model npx trv run app
$ DEBUG=-@travetto/registry npx trv run app
$ DEBUG=@travetto/rest npx trv run app
$ DEBUG=@travetto/*,-@travetto/model npx trv run app
`} />

      Additionally, the logging framework will merge {d.library('Debug')} into the output stream, and supports the standard usage

      <c.Terminal title='Sample environment flags for standard usage' src={`
# Debug
$ DEBUG=express:*,@travetto/rest npx trv run rest
`} />
    </c.SubSection>
  </c.Section>

  <c.Section title='Stream Utilities'>
    The {StreamUtil} class provides basic stream utilities for use within the framework:

    <ul>
      <li>{d.method('toBuffer(src: Readable | Buffer | string): Promise<Buffer>')} for converting a stream/buffer/filepath to a Buffer.</li>
      <li>{d.method('toReadable(src: Readable | Buffer | string):Promise<Readable>')} for converting a stream/buffer/filepath to a Readable</li>
      <li>{d.method('writeToFile(src: Readable, out: string):Promise<void>')} will stream a readable into a file path, and wait for completion.</li>
      <li>{d.method('waitForCompletion(src: Readable, finish:()=>Promise<any>)')} will ensure the stream remains open until the promise finish produces is satisfied.</li>
      <li>{d.method('streamByDelimiter(file: string, options: { delimiter, start, encoding, includeDelimiter}): AsyncIterable<{item:string, read:number}>')} will watch a file for any line changes, and produce those changes as asynchronous iterable stream. Functionally, this is equivalent to using the Unix tail operation on a file</li>
    </ul>
  </c.Section>

  <c.Section title='Object Utilities'>
    Simple functions for providing a minimal facsimile to {d.library('Lodash')}, but without all the weight. Currently {ObjectUtil} includes:

    <ul>
      <li>{d.method('isPrimitive(el)')} determines if {d.input('el')} is a {d.input('string')}, {d.input('boolean')}, {d.input('number')} or {d.input('RegExp')}</li>
      <li>{d.method('isPlainObject(obj)')} determines if the obj is a simple object</li>
      <li>{d.method('isFunction(o)')} determines if {d.input('o')} is a simple {d.input('Function')}</li>
      <li>{d.method('isClass(o)')} determines if {d.input('o')} is a class constructor</li>
      <li>{d.method('isSimple(a)')} determines if {d.input('a')} is a simple value</li>
      <li>{d.method('isPromise(a)')} determines if {d.input('a')} is a promise</li>
    </ul>
  </c.Section>

  <c.Section title='Data Utilities'>
    Data utilities for binding values, and type conversion. Currently {DataUtil} includes:

    <ul>
      <li>
        {d.method('deepAssign(a, b, mode ?)')} which allows for deep assignment of {d.input('b')} onto {d.input('a')}, the {d.input('mode')} determines how aggressive the assignment is, and how flexible it is.  {d.input('mode')} can have any of the following values:
        <ul>
          <li>{d.input('loose')}, which is the default is the most lenient. It will not error out, and overwrites will always happen</li>
          <li>{d.input('coerce')}, will attempt to force values from {d.input('b')} to fit the types of {d.input('a')}, and if it can't it will error out</li>
          <li>{d.input('strict')}, will error out if the types do not match</li>
        </ul>
      </li>
      <li>{d.method('coerceType(input: unknown, type: Class<unknown>, strict = true)')} which allows for converting an input type into a specified {d.input('type')} instance, or throw an error if the types are incompatible.</li>
      <li>{d.method('shallowClone<T = unknown>(a: T): T')} will shallowly clone a field</li>
      <li>{d.method('filterByKeys<T>(obj: T, exclude: (string | RegExp)[]): T')} will filter a given object, and return a plain object (if applicable) with fields excluded using the values in the {d.input('exclude')} input</li>
    </ul>
  </c.Section>

  <c.Section title='Common Utilities'>
    Common utilities used throughout the framework. Currently {Util} includes:

    <ul>
      <li>{d.method('uuid(len: number)')} generates a simple uuid for use within the application.</li>
      <li>{d.method('allowDenyMatcher(rules[])')} builds a matching function that leverages the rules as an allow/deny list, where order of the rules matters.  Negative rules are prefixed by '!'.</li>
      <li>{d.method('naiveHash(text: string)')} produces a fast, and simplistic hash.  No guarantees are made, but performs more than adequately for framework purposes.</li>
      <li>{d.method('makeTemplate<T extends string>(wrap: (key: T, val: TemplatePrim) => string)')} produces a template function tied to the distinct string values that {d.input('key')} supports.</li>
      <li>{d.method('resolvablePromise()')} produces a <c.Class name='Promise' /> instance with the {d.method('resolve')} and {d.method('reject')} methods attached to the instance.  This is extremely useful for integrating promises into async iterations, or any other situation in which the promise creation and the execution flow don't always match up.</li>
    </ul>

    <c.Code title='Sample makeTemplate Usage' src={`
const tpl = makeTemplate((name: 'age'|'name', val) => \`**\${name}: \${val}**\`); 
tpl\`{{age:20}} {{name: 'bob'}}\</>;
// produces
'**age: 20** **name: bob**'
`} />
  </c.Section>
  <c.Section title='Time Utilities'>

    {TimeUtil} contains general helper methods, created to assist with time-based inputs via environment variables, command line interfaces, and other string-heavy based input.

    <c.Code title='Time Utilities' src='src/time.ts' startRe={/TimeUtil/} endRe={/^}/} outline={true} />
  </c.Section>

  <c.Section title='Process Execution'>
    Just like {d.library('ChildProcess')}, the {ExecUtil} exposes {d.method('spawn')} and {d.method('fork')}.  These are generally wrappers around the underlying functionality.  In addition to the base functionality, each of those functions is converted to a {d.input('Promise')} structure, that throws an error on an non-zero return status.<br />

    A simple example would be:

    <c.Code title='Running a directory listing via ls' src='doc/exec.ts' />

    As you can see, the call returns not only the child process information, but the {d.input('Promise')} to wait for.  Additionally, some common patterns are provided for the default construction of the child process. In addition to the standard options for running child processes, the module allows for the following execution options:

    <c.Code title='Execution Options' src='src/exec.ts' startRe={/ExecutionOptions/} endRe={/^[}]/} />

  </c.Section>
  <c.Section title='Shutdown Management'>

    Another key lifecycle is the process of shutting down. The framework provides centralized functionality for running operations on shutdown. Primarily used by the framework for cleanup operations, this provides a clean interface for registering shutdown handlers. The code overrides {d.method('process.exit')} to properly handle {d.input('SIGKILL')} and {d.input('SIGINT')}, with a default threshold of 3 seconds. In the advent of a {d.input('SIGTERM')} signal, the code exits immediately without any cleanup.<br />

    As a registered shutdown handler, you can do.
    <c.Code title='Registering a shutdown handler' src='doc/shutdown.ts' />
  </c.Section>
</>;