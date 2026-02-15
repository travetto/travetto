/** @jsxImportSource @travetto/doc/support */
import { c, d } from '@travetto/doc';
import { ExecUtil, RuntimeError, Util, FileLoader, TimeUtil, EnvProp, RuntimeIndex, Runtime, ConsoleManager, CodecUtil, BinaryUtil, JSONUtil } from '@travetto/runtime';

const EnvLink = d.codeLink('Env', 'src/env.ts', /export const Env/);

export const text = <>
  <c.StdHeader />

  Runtime is the foundation of all {d.library('Travetto')} applications.  It is intended to be a minimal application set, as well as support for commonly shared functionality. It has support for the following key areas:

  <ul>
    <li>Runtime Context</li>
    <li>Environment Support</li>
    <li>Standard Error Support</li>
    <li>Console Management</li>
    <li>Resource Access</li>
    <li>Encoding and Decoding Utilities</li>
    <li>Binary Utilities</li>
    <li>JSON Utilities</li>
    <li>Common Utilities</li>
    <li>Time Utilities</li>
    <li>Process Execution</li>
    <li>Shutdown Management</li>
    <li>Path behavior</li>
  </ul>

  <c.Section title='Runtime Context'>
    While running any code within the framework, there are common patterns/goals for interacting with the underlying code repository.  These include:
    <ul>
      <li>Determining attributes of the running environment (e.g., name, debug information, production flags)</li>
      <li>Resolving paths within the workspace (e.g. standard, tooling, resourcing, modules)</li>
    </ul>

    <c.Code title='Runtime Shape' src={Runtime.constructor} outline />

    <c.SubSection title='Class and Function Metadata'>
      For the framework to work properly, metadata needs to be collected about files, classes and functions to uniquely identify them, with support for detecting changes during live reloads.  To achieve this, every {d.input('class')} is decorated with metadata, including methods, line numbers, and ultimately a unique id stored at {d.input('Ⲑid')}.
    </c.SubSection>

  </c.Section>

  <c.Section title='Environment Support'>
    The functionality we support for testing and retrieving environment information for known environment variables. They can be accessed directly on the {EnvLink} object, and will return a scoped {EnvProp}, that is compatible with the property definition.  E.g. only showing boolean related fields when the underlying flag supports {d.input('true')} or {d.input('false')}

    <c.Code title='Base Known Environment Flags' src='./src/trv.d.ts' startRe={/EnvData/} endRe={/[}]/}></c.Code>

    <c.SubSection title='Environment Property'>
      For a given {EnvProp}, we support the ability to access different properties as a means to better facilitate environment variable usage.
      <c.Code title='EnvProp Shape' src={EnvProp} outline />
    </c.SubSection>
  </c.Section>

  <c.Section title='Standard Error Support'>

    While the framework is 100 % compatible with standard {d.input('Error')} instances, there are cases in which additional functionality is desired. Within the framework we use {RuntimeError} (or its derivatives) to represent framework errors. This class is available for use in your own projects. Some of the additional benefits of using this class is enhanced error reporting, as well as better integration with other modules (e.g. the {d.module('Web')} module and HTTP status codes). <br />

    The {RuntimeError} takes in a message, and an optional payload and / or error classification. The currently supported error classifications are:
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
    This module provides logging functionality, built upon {d.library('NodeConsole')} operations. <br />

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

    <c.SubSection title='How Logging is Instrumented'>

      All of the logging instrumentation occurs at transpilation time.  All {d.method('console.*')} methods are replaced with a call to a globally defined variable that delegates to the {ConsoleManager}.  This module, hooks into the {ConsoleManager} and receives all logging events from all files compiled by the {d.library('Travetto')}. <br />

      A sample of the instrumentation would be:

      <c.Code title='Sample logging at various levels' src='doc/transpile.ts' />

      <c.Code title='Sample After Transpilation' src={RuntimeIndex.resolveFileImport('@travetto/runtime/doc/transpile.ts')} language='javascript' />

      <c.SubSubSection title='Filtering Debug'>

        The {d.input('debug')} messages can be filtered using the patterns from the {d.library('Debug')}.  You can specify wild cards to only {d.input('DEBUG')} specific modules, folders or files.  You can specify multiple, and you can also add negations to exclude specific packages.

        <c.Terminal title='Sample environment flags' src={`
# Debug
$ DEBUG=-@travetto/model ${d.trv} run app
$ DEBUG=-@travetto/registry ${d.trv} run app
$ DEBUG=@travetto/web ${d.trv} run app
$ DEBUG=@travetto/*,-@travetto/model ${d.trv} run app
`} />

        Additionally, the logging framework will merge {d.library('Debug')} into the output stream, and supports the standard usage

        <c.Terminal title='Sample environment flags for standard usage' src={`
# Debug
$ DEBUG=express:*,@travetto/web ${d.trv} run web
`} />
      </c.SubSubSection>
    </c.SubSection>
  </c.Section>

  <c.Section title='Resource Access'>
    The primary access patterns for resources, is to directly request a file, and to resolve that file either via file-system look up or leveraging the {d.module('Manifest')}'s data for what resources were found at manifesting time.<br />

    The {FileLoader} allows for accessing information about the resources, and subsequently reading the file as text/binary or to access the resource as a <c.Class name='Readable' /> stream.  If a file is not found, it will throw an {RuntimeError} with a category of 'notfound'.  <br />

    The {FileLoader} also supports tying itself to {EnvLink}'s {d.field('TRV_RESOURCES')} information on where to attempt to find a requested resource.
  </c.Section>

  <c.Section title='Encoding and Decoding Utilities'>
    The {CodecUtil} class provides a variety of static methods for encoding and decoding data. When working with JSON data, it also provide security checks to prevent prototype pollution. The utility supports the following formats:

    <ul>
      <li>Hex</li>
      <li>Base64</li>
      <li>UTF8</li>
      <li>UTT8 Encoded JSON</li>
      <li>Base64 Encoded JSON</li>
      <li>New Line Delimited UTF8</li>
    </ul>
  </c.Section>

  <c.Section title='Common Utilities'>
    Common utilities used throughout the framework. Currently {Util} includes:

    <ul>
      <li>{d.method('uuid(len: number)')} generates a simple uuid for use within the application.</li>
      <li>{d.method('allowDenyMatcher(rules[])')} builds a matching function that leverages the rules as an allow/deny list, where order of the rules matters.  Negative rules are prefixed by '!'.</li>
      <li>{d.method('hash(text: string, size?: number)')} produces a full sha512 hash.</li>
      <li>{d.method('resolvablePromise()')} produces a <c.Class name='Promise' /> instance with the {d.method('resolve')} and {d.method('reject')} methods attached to the instance.  This is extremely useful for integrating promises into async iterations, or any other situation in which the promise creation and the execution flow don't always match up.</li>
      <li>{d.method('bufferedFileWrite(file:string, content: string)')} will write the file, using a temporary buffer file to ensure that the entire file is written before being moved to the final location.  This helps minimize file watch noise when writing files.</li>
    </ul>

    <c.Code title='Sample makeTemplate Usage' src={`
const tpl = makeTemplate((name: 'age'|'name', value) => \`**\${name}: \${value}**\`); 
tpl\`{{age:20}} {{name: 'bob'}}\</>;
// produces
'**age: 20** **name: bob**'
`} />
  </c.Section>

  <c.Section title='Binary Utilities'>
    The {BinaryUtil} class provides a unified interface for working with binary data across different formats, especially bridging the gap between Node.js specific types ({d.input('Buffer')}, {d.input('Stream')}) and Web Standard types ({d.input('Blob')}, {d.input('ArrayBuffer')}).

    The framework leverages this to allow for seamless handling of binary data, regardless of the source.
  </c.Section>

  <c.Section title='JSON Utilities'>
    The {JSONUtil} class provides a comprehensive set of utilities for working with JSON data, including serialization, deserialization, encoding, and deep cloning capabilities. The utility handles special types like {d.input('Date')}, {d.input('BigInt')}, and {d.input('Error')} objects seamlessly.

    Key features include:
    <ul>
      <li>{d.method('fromUTF8(input, config?)')} - Parse JSON from a UTF-8 string</li>
      <li>{d.method('toUTF8(value, config?)')} - Serialize a value to JSON string</li>
      <li>{d.method('toUTF8Pretty(value)')} - Serialize with pretty formatting (2-space indent)</li>
      <li>{d.method('fromBinaryArray(input)')} - Parse JSON from binary array</li>
      <li>{d.method('toBinaryArray(value, config?)')} - Serialize to binary array (UTF-8 encoded)</li>
      <li>{d.method('toBase64(value)')} - Encode JSON as base64 string</li>
      <li>{d.method('fromBase64(input)')} - Decode JSON from base64 string</li>
      <li>{d.method('clone(input, config?)')} - Deep clone objects with optional transformations</li>
      <li>{d.method('cloneForTransmit(input)')} - Clone for transmission with error serialization</li>
      <li>{d.method('cloneFromTransmit(input)')} - Clone from transmission with type restoration</li>
    </ul>

    The {d.input('TRANSMIT_REVIVER')} automatically restores {d.input('Date')} objects and {d.input('BigInt')} values during deserialization, making it ideal for transmitting complex data structures across network boundaries.
  </c.Section>

  <c.Section title='Time Utilities'>

    {TimeUtil} contains general helper methods, created to assist with time-based inputs via environment variables, command line interfaces, and other string-heavy based input.

    <c.Code title='Time Utilities' src={TimeUtil} outline />
  </c.Section>

  <c.Section title='Process Execution'>
    {ExecUtil} exposes {d.method('getResult')} as a means to wrap {d.library('NodeChildProcess')}'s process object.  This wrapper allows for a promise-based resolution of the subprocess with the ability to capture the stderr/stdout.<br />

    A simple example would be:

    <c.Code title='Running a directory listing via ls' src='doc/exec.ts' />

  </c.Section>

  <c.Section title='Shutdown Management'>

    Another key lifecycle is the process of shutting down. The framework provides centralized functionality for running operations on graceful shutdown. Primarily used by the framework for cleanup operations, this provides a clean interface for registering shutdown handlers. The code intercepts {d.input('SIGTERM')} and {d.input('SIGUSR2')}, with a default threshold of 2 seconds. These events will start the shutdown process, but also clear out the pending queue. If a kill signal is sent again, it will complete immediately. <br />

    As a registered shutdown handler, you can do.
    <c.Code title='Registering a shutdown handler' src='doc/shutdown.ts' />
  </c.Section>

  <c.Section title='Path Behavior'>
    To ensure consistency in path usage throughout the framework, imports pointing at {d.input('node:path')} and {d.input('path')} are rewritten at compile time.  These imports are pointing towards {d.module('Manifest')}'s {d.input('path')}  implementation.  This allows for seamless import/usage patterns with the reliability needed for cross platform support.
  </c.Section>
</>;