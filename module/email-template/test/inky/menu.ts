import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { cleanseOutput, cleanseTemplate } from './util';

@Suite('Menu')
class MenuComponentTest {
  @Test('creates a menu with item tags inside')
  testMenu() {
    const input = `
      <menu>
        <item href="http://zurb.com">Item</item>
      </menu>
    `;
    const expected = `
      <table class="menu">
        <tbody>
          <tr>
            <td>
              <table>
                <tbody>
                  <tr>
                    <th class="menu-item">
                      <a href="http://zurb.com">Item</a>
                    </th>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('creates a menu with items tags inside, containing target="_blank" attribute')
  testTarget() {
    const input = `
      <menu>
        <item href="http://zurb.com" target="_blank">Item</item>
      </menu>
    `;
    const expected = `
      <table class="menu">
        <tbody>
          <tr>
            <td>
              <table>
                <tbody>
                  <tr>
                    <th class="menu-item">
                      <a href="http://zurb.com" target="_blank">Item</a>
                    </th>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('creates a menu with classes')
  testClasses() {
    const input = `
      <menu class="vertical">
      </menu>
    `;
    const expected = `
      <table class="menu vertical">
        <tbody>
          <tr>
            <td>
              <table>
                <tbody>
                  <tr>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }

  @Test('works without using an item tag')
  testWithoutItem() {
    const input = `
      <menu>
        <th class="menu-item"><a href="http://zurb.com">Item 1</a></th>
      </menu>
    `;
    const expected = `
      <table class="menu">
        <tbody>
          <tr>
            <td>
              <table>
                <tbody>
                  <tr>
                    <th class="menu-item">
                      <a href="http://zurb.com">Item 1</a>
                    </th>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    `;

    assert(cleanseTemplate(input) === cleanseOutput(expected));
  }
}