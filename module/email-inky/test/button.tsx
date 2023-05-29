/** @jsxImportSource @travetto/email-inky */

import assert from 'assert';

import { Suite, Test } from '@travetto/test';

import { Button } from '../src/components';
import { renderJSX } from './util';

const SPACER_16 = <table class="spacer">
  <tbody>
    <tr>
      <td height="16px" style="font-size:16px;line-height:16px;">&nbsp;</td>
    </tr>
  </tbody>
</table>;

@Suite('Button')
class ButtonComponentTest {

  @Test('creates a simple button')
  async testButton() {
    const input = <Button href="http://zurb.com">Button</Button>;
    const expected = <>
      <table class="button">
        <tbody>
          <tr>
            <td>
              <table>
                <tbody>
                  <tr>
                    <td>
                      <a href="http://zurb.com">Button</a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
      {SPACER_16}
    </>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('creates a button with target="_blank" attribute')
  async testTarget() {
    const input = <Button href="http://zurb.com" target="_blank">Button</Button>;
    const expected = <>
      <table class="button">
        <tbody>
          <tr>
            <td>
              <table>
                <tbody>
                  <tr>
                    <td>
                      <a href="http://zurb.com" target="_blank">Button</a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
      {SPACER_16}
    </>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('creates a button with classes')
  async testClasses() {
    const input = <Button class="small alert" href="http://zurb.com">Button</Button>;
    const expected =
      <>
        <table class="button small alert">
          <tbody>
            <tr>
              <td>
                <table>
                  <tbody>
                    <tr>
                      <td>
                        <a href="http://zurb.com">Button</a>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
        {SPACER_16}
      </>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('creates a correct expanded button')
  async testExpanded() {
    const input = <Button class="expand" href="http://zurb.com">Button</Button>;
    const expected = <>
      <table class="button expand">
        <tbody>
          <tr>
            <td>
              <table>
                <tbody>
                  <tr>
                    <td>
                      <center>
                        <a href="http://zurb.com" align="center" class="float-center">Button</a>
                      </center>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
            <td class="expander"></td>
          </tr>
        </tbody>
      </table>
      {SPACER_16}
    </>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }
}
