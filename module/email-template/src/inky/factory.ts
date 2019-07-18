import { Node, serialize, parse, parseFragment } from 'parse5';

import { HtmlUtil, Parse5Adapter } from '../html-util';

export const COMPONENT_DEFAULTS = {
  button: 'button',
  row: 'row',
  columns: 'columns',
  container: 'container',
  callout: 'callout',
  'block-grid': 'blockGrid',
  menu: 'menu',
  item: 'menuItem',
  center: 'center',
  spacer: 'spacer',
  wrapper: 'wrapper',
  'h-line': 'hLine',
  hr: 'hr'
};

export class ComponentFactory {
  private spacer16: string;
  public componentTags: typeof COMPONENT_DEFAULTS;

  constructor(
    public columnCount: number = 12,
    componentTags: Partial<typeof COMPONENT_DEFAULTS> = {}
  ) {
    this.componentTags = { ...COMPONENT_DEFAULTS, ...componentTags };
    this.spacer16 = this.convertAll(`<spacer size="16"></spacer>`);
  }

  columns(element: Node) {
    const attrs = HtmlUtil.getAttrMap(element);
    const inner = HtmlUtil.getInner(element);

    let expander = '';

    // Add 1 to include current column
    const colCount = Parse5Adapter.getChildNodes(element).length;

    // Check for sizes. If no attribute is provided, default to small-12. Divide evenly for large columns
    const smallSize = parseInt(attrs.small || '0', 10) || this.columnCount;
    const largeSize = parseInt(attrs.large || attrs.small || '0', 10) || Math.trunc(this.columnCount / colCount);
    const noExpander = 'no-expander' in attrs && attrs['no-expander'] !== 'false';

    attrs.class = HtmlUtil.classes(`small-${smallSize}`, `large-${largeSize}`, 'columns', attrs.class);

    delete attrs.large;
    delete attrs.small;
    delete attrs['no-expander'];

    // If the column contains a nested row, the .expander class should not be used
    if (largeSize === this.columnCount && !noExpander) {
      let hasRow = false;
      HtmlUtil.visit(element, (node, descend) => {
        if (Parse5Adapter.getTagName(node) === 'row') {
          hasRow = true;
        } else if (/\brow\b/.test(HtmlUtil.getAttrMap(node).class || '')) {
          hasRow = true;
        } else {
          descend();
        }
      });
      if (!hasRow) {
        expander = '\n<th class="expander"></th>';
      }
    }

    // Final HTML output
    return `
      <th ${HtmlUtil.toStr(attrs)}>
        <table>
          <tbody>
            <tr>
              <th>${inner}</th>${expander}
            </tr>
          </tbody>
        </table>
      </th>`;
  }

  hLine(element: Node) {
    const attrs = HtmlUtil.getAttrMap(element);

    return `
    <table class="${HtmlUtil.classes('h-line', attrs.class)}">
      <tr><th>&nbsp;</th></tr>
    </table>`;
  }

  row(element: Node) {
    const attrs = HtmlUtil.getAttrMap(element);
    const inner = HtmlUtil.getInner(element);

    attrs.class = HtmlUtil.classes('row', attrs.class);

    return `
    <table ${HtmlUtil.toStr(attrs)}>
      <tbody>
        <tr>${inner}</tr>
      </tbody>
    </table>`;
  }

  button(element: Node) {
    const attrs = HtmlUtil.getAttrMap(element);
    let inner = HtmlUtil.getInner(element);

    const { href, target, class: cls } = attrs;
    let expander = '';
    // If we have the href attribute we can create an anchor for the inner of the button;
    if (href) {
      inner = `<a ${HtmlUtil.toStr({ href, target })}>${inner}</a>`;
    }

    // If the button is expanded, it needs a <center> tag around the content
    if (/\bexpand(ed)?\b/.test(cls || '')) {
      inner = this.convertAll(`<center>
        ${inner}
      </center>`);
      expander = `\n<td class="expander"></td>`;
    }

    // The .button class is always there, along with any others on the <button> element
    return `
      <table class="${HtmlUtil.classes('button', cls)}">
        <tbody>
          <tr>
            <td>
              <table>
                <tbody>
                  <tr>
                    <td>
                      ${inner}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>${expander}
          </tr>
        </tbody>
      </table>
      ${this.spacer16}`;
  }

  container(element: Node) {
    const attrs = HtmlUtil.getAttrMap(element);
    const inner = HtmlUtil.getInner(element);

    attrs.class = HtmlUtil.classes('container', attrs.class);
    attrs.align = 'center';

    return `
    <table ${HtmlUtil.toStr(attrs)}>
      <tbody>
        <tr><td>${inner}</td></tr>
      </tbody>
    </table>`;

  }

  blockGrid(element: Node) {
    const attrs = HtmlUtil.getAttrMap(element);
    const inner = HtmlUtil.getInner(element);

    return `
    <table class="${HtmlUtil.classes('block-grid', attrs.up ? `up-${attrs.up}` : '', attrs.class)}">
      <tbody>
        <tr>${inner}</tr>
      </tbody>
    </table>`;
  }

  menu(element: Node) {
    const attrs = HtmlUtil.getAttrMap(element);
    let inner = HtmlUtil.getInner(element);

    if (inner.trim() && !/<(th|td)/.test(inner)) {
      inner = `<th class="menu-item">${inner}</th>`;
    }

    attrs.class = HtmlUtil.classes('menu', attrs.class);
    return `
      <table ${HtmlUtil.toStr(attrs)}>
        <tbody>
          <tr>
            <td>
              <table>
                <tbody>
                  <tr>
                    ${inner}
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>`;
  }

  menuItem(element: Node) {
    const attrs = HtmlUtil.getAttrMap(element);
    const inner = HtmlUtil.getInner(element);

    // Prepare optional target attribute for the <a> element
    attrs.class = HtmlUtil.classes('menu-item', attrs.class);
    const { href, target, ...parentAttrs } = attrs;
    return `
       <th ${HtmlUtil.toStr(parentAttrs)}>
         <a ${HtmlUtil.toStr({ href, target })}>${inner}</a>
       </th>`;
  }

  center(element: Node) {
    for (const child of (Parse5Adapter.getChildNodes(element) || [])) {
      if (Parse5Adapter.isElementNode(child)) {
        HtmlUtil.setDomAttribute(child, 'align', 'center');
        HtmlUtil.setDomAttribute(child, 'class', 'float-center');
      }
    }

    HtmlUtil.visit(element, (node: Node, descend: () => void) => {
      descend();
      if (Parse5Adapter.getTagName(node) === 'item') {
        HtmlUtil.setDomAttribute(node, 'class', 'float-center');
      } else if (/\bmenu-item\b/.test(HtmlUtil.getAttrMap(node).class || '')) {
        HtmlUtil.setDomAttribute(node, 'class', 'float-center');
      }
    });

    const df = Parse5Adapter.createDocumentFragment();
    Parse5Adapter.appendChild(df, element);
    return serialize(df);
  }

  callout(element: Node) {
    const attrs = HtmlUtil.getAttrMap(element);
    const inner = HtmlUtil.getInner(element);

    const cls = HtmlUtil.classes('callout-inner', attrs.class);
    delete attrs.class;

    return `
      <table ${HtmlUtil.toStr(attrs)} class="callout">
        <tbody>
          <tr>
            <th class="${cls}">
              ${inner}
            </th>
            <th class="expander"></th>
          </tr>
        </tbody>
      </table>`;
  }

  spacer(element: Node) {
    const attrs = HtmlUtil.getAttrMap(element);
    const html: string[] = [];

    attrs.class = HtmlUtil.classes('spacer', attrs.class);

    const smAttr = attrs['size-sm'];
    const lgAttr = attrs['size-lg'];
    const sm = smAttr ? parseInt(smAttr, 10) : undefined;
    const lg = lgAttr ? parseInt(lgAttr, 10) : undefined;

    const buildSpacer = (size: number | string, extraClass: string = '') => {
      const newAttrs = { ...attrs };
      delete newAttrs['size-sm'];
      delete newAttrs['size-lg'];
      delete newAttrs['size'];
      if (extraClass) {
        newAttrs.class += ` ${extraClass}`;
      }
      return `
        <table ${HtmlUtil.toStr(newAttrs)}>
          <tbody>
            <tr>
              <td height="${size}px" style="font-size:${size}px;line-height:${size}px;">&nbsp;</td>
            </tr>
          </tbody>
        </table>
      `;
    };

    if (sm || lg) {
      if (sm) {
        html.push(buildSpacer(sm, 'hide-for-large'));
      }
      if (lg) {
        html.push(buildSpacer(lg, 'show-for-large'));
      }
    } else {
      html.push(buildSpacer(attrs.size || 16));
    }

    return html.join('\n');
  }

  wrapper(element: Node) {
    const attrs = HtmlUtil.getAttrMap(element);
    const inner = HtmlUtil.getInner(element);

    attrs.class = HtmlUtil.classes('wrapper', attrs.class);
    attrs.align = 'center';

    return `
      <table ${HtmlUtil.toStr(attrs)}>
        <tbody>
          <tr>
            <td class="wrapper-inner">
              ${inner}
            </td>
          </tr>
        </tbody>
      </table>`;
  }

  hr(element: Node) {
    const attrs = HtmlUtil.getAttrMap(element);
    attrs.class = HtmlUtil.classes('hr', attrs.class);
    return `<div ${HtmlUtil.toStr(attrs)}></div>`;
  }

  generate(element: Node) {
    const tagName = Parse5Adapter.getTagName(element);

    if (tagName in this.componentTags) {
      const fnName = (this.componentTags as Record<string, string>)[tagName];
      const text: string = (this as any)[fnName](element);
      return text.trim();
    } else {
      // If it's not a custom component, return it as-is
      return `<tr><td>${serialize(element)}</td></tr>`;
    }
  }

  convertAll(document: Node): Node;
  convertAll(document: string): string;
  convertAll(document: string | Node): string | Node {
    const traverse = (node: Node) => {
      const children = Parse5Adapter.getChildNodes(node) || [];
      let i = -1;
      for (const child of children.slice(0)) {
        i = i + 1;
        const tagName = Parse5Adapter.getTagName(child);
        if (!tagName) {
          continue;
        }
        traverse(child);
        if (tagName in this.componentTags) {
          if (tagName === this.componentTags.columns && !('hasColumns' in node)) {
            (node as any).hasColumns = true;
            const all = children.filter(x => Parse5Adapter.isElementNode(x));
            HtmlUtil.setDomAttribute(all[0], 'class', 'first');
            HtmlUtil.setDomAttribute(all[all.length - 1], 'class', 'last');
          }
          const text = this.generate(child);
          const newFrag = parseFragment(text);
          const newNodes = (Parse5Adapter.getChildNodes(newFrag).filter(x => Parse5Adapter.isElementNode(x)))!;
          children.splice(i, 1, ...newNodes);
        }
      }
      return node;
    };

    if (typeof document === 'string') {
      const node = document.includes('<html') ? parse(document) : parseFragment(document);
      const ret = traverse(node);
      const out = serialize(ret);
      return out;
    } else {
      return traverse(document);
    }
  }
}