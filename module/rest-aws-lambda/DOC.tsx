/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

export const text = <>
  <c.StdHeader />
  The module provides support basic support with AWS lambdas. When using one of the specific rest modules (e.g. {d.mod('RestExpress')}), you can install the appropriate lambda-related dependencies installed (e.g. {d.library('ServerlessExpress')}) to enable integration with AWS.  Nothing in the code needs to be modified to support the AWS integration, but there are some limitations of using AWS Lambdas as HTTP handlers.

  <c.Section title='CLI - Packaging Lambdas'>
    <c.Execution title='Invoking a Package Build' cmd='trv' args={['pack:lambda', '-h']} />
  </c.Section>
</>;
