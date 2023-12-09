/** @jsxImportSource @travetto/email-inky */

import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { renderJSX } from './util';
import { Container } from '../src/components';

@Suite('Inky')
class InkyTest {

  @Test('does not choke on inline elements')
  async testInline() {
    const input = <Container>This is a link to <a href="#">ZURB.com</a>.</Container>;
    const expected = <table align="center" className="container">
      <tbody>
        <tr>
          <td>This is a link to <a href="#">ZURB.com</a>.</td>
        </tr>
      </tbody>
    </table>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('does not choke on special characters')
  async testSpecial() {
    const input = <Container>This is a link tö <a href="#">ZURB.com</a>.</Container>;
    const expected = <table align="center" className="container">
      <tbody>
        <tr>
          <td>This is a link tö <a href="#">ZURB.com</a>.</td>
        </tr>
      </tbody>
    </table>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('does not convert these characters into entities')
  async testEntities() {
    const input = <Container>There's &nbsp; some amazing things here!</Container>;
    const expected = <table align="center" className="container">
      <tbody>
        <tr>
          <td>There's &nbsp; some amazing things here!</td>
        </tr>
      </tbody>
    </table>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('does not decode entities if non default cheerio config is given')
  async testDecode() {
    const input = <Container>"should not replace quotes"</Container>;
    const expected = <table align="center" className="container">
      <tbody>
        <tr>
          <td>"should not replace quotes"</td>
        </tr>
      </tbody>
    </table>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }
}