const { doc: d, Code, Section, Mod, lib, Ref } = require('@travetto/doc');
const { WithAsyncContext } = require('./src/decorator');
const { AsyncContext } = require('./src/service');

const AsyncContextInterceptor = Ref('AsyncContextInterceptor', './src/extension/rest.interceptor.ts');

exports.text = d`
This module provides a wrapper around node's ${lib.AsyncHooks} to maintain context across async calls. This is generally used for retaining contextual user information at various levels of async flow.

The most common way of utilizing the context, is via the ${WithAsyncContext} decorator.  The decorator requires the class it's being used in, to have a ${AsyncContext} member, as it is the source of the contextual information.

The decorator will load the context on invocation, and will keep the context active during the entire asynchronous call chain.

${Code('Usage of context within a service', 'alt/docs/src/usage.ts')}

The decorator also allows for a priming of the contextual information.  This is generally useful for system generated operations that are not initiated by a user.

${Code('Usage of context within a service', 'alt/docs/src/usage-primed.ts')}

${Section('Extension - Rest')}

Within the ${Mod('rest')} module, it can be challening to share context across the various layers that may be touched by a request.  This module provides ${AsyncContextInterceptor} to create a data store that will be private to an individual request. This is used by ${Mod('auth-rest')} to store authentiated user information for built-in authorization and permission validation.
`;