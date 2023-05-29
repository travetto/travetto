/** @jsxImportSource @travetto/email-inky */

import assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { renderJSX } from './util';
import { Container } from '../__index__';

@Suite('Container')
class ContainerTest {

  @Test('works when rendering a containers')
  async testFull() {
    const input = <Container></Container>;
    const expected = <table align="center" class="container">
      <tbody>
        <tr>
          <td></td>
        </tr>
      </tbody>
    </table>;
    assert(await renderJSX(input) === await renderJSX(expected));
  }
}
