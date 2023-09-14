/** @jsxImportSource @travetto/email-inky */

import assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { renderJSX } from './util';
import { Item, Menu } from '../__index__';

@Suite('Menu')
class MenuComponentTest {
  @Test('creates a menu with item tags inside')
  async testMenu() {
    const input = <Menu>
      <Item href="http://zurb.com">Item</Item>
    </Menu>;

    const expected = <table className="menu">
      <tbody>
        <tr>
          <td>
            <table>
              <tbody>
                <tr>
                  <th className="menu-item">
                    <a href="http://zurb.com">Item</a>
                  </th>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('creates a menu with items tags inside, containing target="_blank" attribute')
  async testTarget() {
    const input = <Menu>
      <Item href="http://zurb.com" target="_blank">Item</Item>
    </Menu>;
    const expected = <table className="menu">
      <tbody>
        <tr>
          <td>
            <table>
              <tbody>
                <tr>
                  <th className="menu-item">
                    <a href="http://zurb.com" target="_blank">Item</a>
                  </th>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('creates a menu with classes')
  async testClasses() {
    const input = <Menu className="vertical"></Menu>;
    const expected = <table className="vertical menu">
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
    </table>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('works without using an item tag')
  async testWithoutItem() {
    const input = <Menu>
      <th className="menu-item"><a href="http://zurb.com">Item 1</a></th>
    </Menu>;

    const expected = <table className="menu">
      <tbody>
        <tr>
          <td>
            <table>
              <tbody>
                <tr>
                  <th className="menu-item">
                    <a href="http://zurb.com">Item 1</a>
                  </th>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }
}