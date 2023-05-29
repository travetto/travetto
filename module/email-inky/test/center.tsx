/** @jsxImportSource @travetto/email-inky */

import assert from 'assert';

import { Suite, Test } from '@travetto/test';

import { renderJSX } from './util';
import { Center, Item, Menu } from '../src/components';

@Suite()
export class CenterComponentTest {
  @Test('applies a text-center class and center alignment attribute to the first child')
  async testCenter() {
    const input = <Center><div></div></Center>;
    const expected = <center>
      <div align="center" class="float-center"></div>
    </center>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('doesn\'t choke if center tags are nested')
  async testNested() {
    const input = <Center>
      <Center>
      </Center>
    </Center>;

    const expected = <center>
      <center align="center" class="float-center">
      </center>
    </center>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('applies the class float-center to <item> elements')
  async testFloat() {
    const input = <Center>
      <Menu>
        <Item href="#"></Item>
      </Menu>
    </Center>;

    const expected = <center>
      <table align="center" class="float-center menu">
        <tbody>
          <tr>
            <td>
              <table>
                <tbody>
                  <tr>
                    <th class="float-center menu-item">
                      <a href="#"></a>
                    </th>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </center>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }
}