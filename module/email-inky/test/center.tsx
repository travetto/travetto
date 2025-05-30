/** @jsxImportSource @travetto/email-inky */

import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Center, Menu, Item } from '@travetto/email-inky';

import { renderJSX } from './util.ts';

@Suite()
export class CenterComponentTest {
  @Test('applies a text-center class and center alignment attribute to the first child')
  async testCenter() {
    const input = <Center><div></div></Center>;
    const expected = <center>
      <div align="center" className="float-center"></div>
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
      <center align="center" className="float-center">
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
      <table align="center" className="float-center menu">
        <tbody>
          <tr>
            <td>
              <table>
                <tbody>
                  <tr>
                    <th className="float-center menu-item">
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