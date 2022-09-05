import { d, lib } from '@travetto/doc';

import { WithAsyncContext } from './src/decorator';
import { AsyncContext } from './src/service';

export const text = d`
${d.Header()}

This module provides a wrapper around node's ${lib.AsyncHooks} to maintain context across async calls. This is generally used for retaining contextual user information at various levels of async flow.

The most common way of utilizing the context, is via the ${WithAsyncContext} decorator.  The decorator requires the class it's being used in, to have a ${AsyncContext} member, as it is the source of the contextual information.

The decorator will load the context on invocation, and will keep the context active during the entire asynchronous call chain.

${d.Code('Usage of context within a service', 'doc/usage.ts')}

The decorator also allows for a priming of the contextual information.  This is generally useful for system generated operations that are not initiated by a user.

${d.Code('Usage of context within a service', 'doc/usage-primed.ts')}
`;