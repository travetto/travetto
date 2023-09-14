/** @jsxImportSource @travetto/email-inky */

import assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { renderJSX } from './util';
import { Spacer } from '../__index__';

@Suite('Spacer')

class SpacerComponentTest {
  @Test('creates a spacer element with correct size')
  async testSpacer() {
    const input = <Spacer size={10}></Spacer>;
    const expected = <table className="spacer">
      <tbody>
        <tr>
          <td height="10px" style="font-size:10px;line-height:10px;">{'&nbsp;'}</td>
        </tr>
      </tbody>
    </table>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('creates a spacer with a default size or no size defined')
  async testSized() {
    const input = <Spacer></Spacer>;
    const expected = <table className="spacer">
      <tbody>
        <tr>
          <td height="16px" style="font-size:16px;line-height:16px;">{'&nbsp;'}</td>
        </tr>
      </tbody>
    </table>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('creates a spacer element for small screens with correct size')
  async testSmall() {
    const input = <Spacer small={10}></Spacer>;
    const expected = <table className="spacer hide-for-large">
      <tbody>
        <tr>
          <td height="10px" style="font-size:10px;line-height:10px;">{'&nbsp;'}</td>
        </tr>
      </tbody>
    </table>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('creates a spacer element for large screens with correct size')
  async testLarge() {
    const input = <Spacer large={20}></Spacer>;
    const expected = <table className="spacer show-for-large">
      <tbody>
        <tr>
          <td height="20px" style="font-size:20px;line-height:20px;">{'&nbsp;'}</td>
        </tr>
      </tbody>
    </table>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('creates a spacer element for small and large screens with correct sizes')
  async testSmallAndLarge() {
    const input = <Spacer small={10} large={20}></Spacer>;
    const expected = <>
      <table className="spacer hide-for-large">
        <tbody>
          <tr>
            <td height="10px" style="font-size:10px;line-height:10px;">{'&nbsp;'}</td>
          </tr>
        </tbody>
      </table>
      <table className="spacer show-for-large" >
        <tbody>
          <tr>
            <td height="20px" style="font-size:20px;line-height:20px;">{'&nbsp;'}</td>
          </tr>
        </tbody>
      </table>
    </>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }

  @Test('copies classes to the final spacer HTML')
  async testClasses() {
    const input = <Spacer size={10} className="bgcolor"></Spacer>;
    const expected = <table className="bgcolor spacer">
      <tbody>
        <tr>
          <td height="10px" style="font-size:10px;line-height:10px;">{'&nbsp;'}</td>
        </tr>
      </tbody>
    </table>;

    assert(await renderJSX(input) === await renderJSX(expected));
  }
}
