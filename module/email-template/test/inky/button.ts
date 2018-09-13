import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';

import { cleanseOutput, cleanseTemplate } from './util';

const SPACER_16 = `<table class="spacer">
<tbody>
  <tr>
    <td height="16px" style="font-size:16px;line-height:16px;">&nbsp;</td>
  </tr>
</tbody>
</table>`;

@Suite('Button')
class ButtonComponentTest {

  @Test('creates a simple button')
  testButton() {
    const input = '<button href="http://zurb.com">Button</button>';
    const expected = `
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
      ${SPACER_16}
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('creates a button with target="_blank" attribute')
  testTarget() {
    const input = '<button href="http://zurb.com" target="_blank">Button</button>';
    const expected = `
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
      ${SPACER_16}
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('creates a button with classes')
  testClasses() {
    const input = `
      <button class="small alert" href="http://zurb.com">Button</button>
    `;
    const expected = `
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
      ${SPACER_16}
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('creates a correct expanded button')
  testExpanded() {
    const input = `
      <button class="expand" href="http://zurb.com">Button</button>
    `;
    const expected = `
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
      ${SPACER_16}
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }
}
