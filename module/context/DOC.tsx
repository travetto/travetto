/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

import { AsyncContext, AsyncContextValue, WithAsyncContext } from '@travetto/context';

export const text = <>
  <c.StdHeader />
  This module provides a wrapper around node's {d.library('NodeAsyncHooks')} to maintain context across async calls. This is generally used for retaining contextual user information at various levels of async flow. <br />

  The most common way of utilizing the context, is via the {WithAsyncContext} decorator.  The decorator requires the class it's being used in, to have a {AsyncContext} member, as it is the source of the contextual information. <br />

  The decorator will load the context on invocation, and will keep the context active during the entire asynchronous call chain. <br />

  <strong>NOTE:</strong> while access context properties directly is supported, it is recommended to use {AsyncContextValue} instead.

  <c.Code title='Usage of context within a service' src='doc/usage.ts' />

  <c.Section title={AsyncContextValue.name}>
    Within the framework that is a need to access context values, in a type safe fashion.  Additionally, we have the requirement to keep the data accesses isolated from other operations.  To this end, {AsyncContextValue} was created to support this use case.  This class represents the ability to define a simple read/write contract for a given context field.  It also provides some supplemental functionality, e.g., the ability to suppress errors if a context is not initialized.

    <c.Code src={AsyncContextValue} outline title={`Source for ${AsyncContextValue.name}`} />

    <c.Code title='Usage of context value within a service' src='doc/usage-value.ts' />

  </c.Section>
</>;