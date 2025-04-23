/** @jsxImportSource @travetto/doc */
import { c, d } from '@travetto/doc';

export const text = <>
  <c.StdHeader />
  This module provides an adapter between {d.mod('Web')} and {d.library('AwsLambda')}.  The event-driven invocation model for {d.mod('Web')} aligns cleanly with {d.library('AwsLambda')}'s model for event-driven operation.  <br />

  <strong>NOTE:</strong> The only caveat to consider, is that while the framework supports streams for responses, {d.library('AwsLambda')} does not. Any streaming result will be read and converted into a {Buffer} before being sent back.

  <c.Section title='CLI - Packaging Lambdas'>
    <c.Execution title='Invoking a Package Build' cmd='trv' args={['pack:lambda', '-h']} />
  </c.Section>
</>;
