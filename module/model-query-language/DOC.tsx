/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

export const text = <>
  <c.StdHeader />
  This module provides a textual query language for the {d.mod('ModelQuery')} interface. The language itself is fairly simple, boolean logic, with parenthetical support.The operators supported are:

  <c.Section title='Query Language'>
    <ul>
      <li>{d.input('<')}, {d.input('<=')} - Less than, and less than or equal to</li>
      <li>{d.input('>')}, {d.input('>=')} - Greater than, and greater than or equal to</li>
      <li>{d.input('!=')}, {d.input('==')} - Not equal to, and equal to</li>
      <li>{d.input('~')} - Matches regular expression, supports the {d.input('i')} flag to trigger case insensitive searches</li>
      <li>{d.input('!')}, {d.input('not')} - Negates a clause</li>
      <li>{d.input('in')}, {d.input('not-in')} - Supports checking if a field is in a list of literal values</li>
      <li>{d.input('and')}, {d.input('&&')} - Intersection of clauses</li>
      <li>{d.input('or')}, {d.input('||')} - Union of clauses</li>
    </ul>

    All sub fields are dot separated for access, e.g. {d.field('user.address.city')}.A query language version of the previous query could look like:

    <c.Code title='Query language with boolean checks and exists check' src='not (age < 35) and contact != null' language='sql' />

    A more complex query would look like:

    <c.Code title='Query language with more complex needs'
      src="user.role in ['admin', 'root'] && (user.address.state == 'VA' || user.address.city == 'Springfield')" language='sql' />

    <c.SubSection title='Regular Expression'>
      When querying with regular expressions, patterns can be specified as {d.input('\'strings\'')} or as {d.input('/patterns/')}.  The latter allows for the case insensitive modifier: {d.input('/pattern/i')}.  Supporting the insensitive flag is up to the underlying model implementation.
    </c.SubSection>
  </c.Section>
</>;