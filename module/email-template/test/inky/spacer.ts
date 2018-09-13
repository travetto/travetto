import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { cleanseOutput, cleanseTemplate } from './util';

@Suite('Spacer')

class SpacerComponentTest {
  @Test('creates a spacer element with correct size')
  testSpacer() {
    const input = '<spacer size="10"></spacer>';
    const expected = `
      <table class="spacer">
        <tbody>
          <tr>
            <td height="10px" style="font-size:10px;line-height:10px;">&nbsp;</td>
          </tr>
        </tbody>
      </table>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('creates a spacer with a default size or no size defined')
  testSized() {
    const input = '<spacer></spacer>';
    const expected = `
      <table class="spacer">
        <tbody>
          <tr>
            <td height="16px" style="font-size:16px;line-height:16px;">&nbsp;</td>
          </tr>
        </tbody>
      </table>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('creates a spacer element for small screens with correct size')
  testSmall() {
    const input = '<spacer size-sm="10"></spacer>';
    const expected = `
      <table class="spacer hide-for-large">
        <tbody>
          <tr>
            <td height="10px" style="font-size:10px;line-height:10px;">&nbsp;</td>
          </tr>
        </tbody>
      </table>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('creates a spacer element for large screens with correct size')
  testLarge() {
    const input = '<spacer size-lg="20"></spacer>';
    const expected = `
      <table class="spacer show-for-large">
        <tbody>
          <tr>
            <td height="20px" style="font-size:20px;line-height:20px;">&nbsp;</td>
          </tr>
        </tbody>
      </table>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('creates a spacer element for small and large screens with correct sizes')
  testSmallAndLarge() {
    const input = '<spacer size-sm="10" size-lg="20"></spacer>';
    const expected = `
      <table class="spacer hide-for-large">
        <tbody>
          <tr>
            <td height="10px" style="font-size:10px;line-height:10px;">&nbsp;</td>
          </tr>
        </tbody>
      </table>
      <table class="spacer show-for-large">
        <tbody>
          <tr>
            <td height="20px" style="font-size:20px;line-height:20px;">&nbsp;</td>
          </tr>
        </tbody>
      </table>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('copies classes to the final spacer HTML')
  testClasses() {
    const input = '<spacer size="10" class="bgcolor"></spacer>';
    const expected = `
      <table class="spacer bgcolor">
        <tbody>
          <tr>
            <td height="10px" style="font-size:10px;line-height:10px;">&nbsp;</td>
          </tr>
        </tbody>
      </table>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }
}
