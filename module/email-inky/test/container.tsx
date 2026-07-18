/** @jsxImportSource @travetto/email-inky/support */

import assert from 'node:assert';

import { Container } from '@travetto/email-inky';
import { Suite, Test } from '@travetto/test';

import { renderJSX } from './util.ts';

@Suite('Container')
class ContainerTest {
  @Test('works when rendering a containers')
  async testFull() {
    const input = <Container></Container>;
    const expected = (
      <table align="center" className="container">
        <tbody>
          <tr>
            <td></td>
          </tr>
        </tbody>
      </table>
    );

    assert((await renderJSX(input)) === (await renderJSX(expected)));
  }
}
