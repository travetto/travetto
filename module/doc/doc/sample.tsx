/** @jsxImportSource @travetto/doc/support */
import { c } from '@travetto/doc';

export const text = <>
  <c.StdHeader />

  Sample documentation for fictional module.  This module fictitiously relies upon <c.Module name='Cache' /> functionality.

  <ol>
    <li>First</li>
    <li>Second</li>
    <li><c.Path name='Special' /></li>
  </ol>

  <c.Section title='Content'>
    <c.Code title='Document Sample' src='./src/test.ts' />

    <c.SubSection title='Output'>
      <c.Execution title='Run program' cmd='trv' />
    </c.SubSection>
  </c.Section>
</>;