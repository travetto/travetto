/** @jsxImportSource @travetto/doc/support */
import { c, d } from '@travetto/doc';

import { PackLambdaCommand } from './support/cli.pack_lambda.ts';

export const text = <>
  <c.StdHeader />
  This module provides an adapter between {d.module('Web')} and {d.library('AwsLambda')}.  The event-driven invocation model for {d.module('Web')} aligns cleanly with {d.library('AwsLambda')}'s model for event-driven operation.  <br />

  <strong>NOTE:</strong> The only caveat to consider, is that while the framework supports streams for responses, {d.library('AwsLambda')} does not. Any streaming result will be read and converted into a {d.library('NodeBuffer')} before being sent back.

  <c.CliHelpSection commandClass={PackLambdaCommand}>
    Use this command to produce the Lambda-ready archive for deployment.
    <c.CliHelpExecution commandClass={PackLambdaCommand} />
  </c.CliHelpSection>
</>;
