import { JSXElement } from '@travetto/email-inky/jsx-runtime';

import { RenderProvider, RenderState } from '../types';
import { RenderContext } from './context';

export const SUMMARY_STYLE = Object.entries({
  display: 'none',
  'font-size': '1px',
  color: '#333333',
  'line-height': '1px',
  'max-height': '0px',
  'max-width': '0px',
  opacity: '0',
  overflow: 'hidden'
}).map(([k, v]) => `${k}: ${v}`).join('; ');

const stdInline = async ({ recurse, el }: RenderState<JSXElement, RenderContext>): Promise<string> =>
  `<${el.type}>${await recurse()}</${el.type}>`;

const std = async ({ recurse, el }: RenderState<JSXElement, RenderContext>): Promise<string> =>
  `<${el.type}>${await recurse()}</${el.type}>\n`;

const stdFull = async ({ recurse, el }: RenderState<JSXElement, RenderContext>): Promise<string> =>
  `\n<${el.type}>${await recurse()}</${el.type}>\n`;

const classStr = (existing: string | undefined, ...toAdd: string[]): string => {
  const out = [];
  const seen = new Set<string>();
  for (const item of existing?.split(/\s+/) ?? []) {
    if (item && !seen.has(item)) {
      out.push(item);
      seen.add(item);
    }
  }
  for (const item of toAdd) {
    if (item && !seen.has(item)) {
      out.push(item);
      seen.add(item);
    }
  }
  return out.join(' ');
};

const allowedProps = new Set(['id', 'class', 'href', 'target', 'title', 'align', 'valign', 'width', 'height', 'src']);

const propsToStr = (props: Record<string, unknown>, ...addClasses: string[]): string => {
  const out = { class: '', ...props };
  out.class = classStr(out.class, ...addClasses);
  if (!out.class) {
    // @ts-expect-error
    delete out.class;
  }
  return Object.entries(out).filter(([k]) => allowedProps.has(k)).map(([k, v]) => `${k}="${v}"`).join(' ');
};

const getKids = (el: JSXElement): JSXElement[] => {
  const kids = el.props.children;
  if (kids) {
    return !Array.isArray(kids) ? [kids] : kids;
  }
  return [];
};

const visit = (el: JSXElement, onVisit: (fn: JSXElement) => boolean | undefined | void, depth = 0): boolean | undefined => {
  if (depth > 0) {
    const res = onVisit(el);
    if (res === true) {
      return true;
    }
  }
  for (const item of getKids(el)) {
    const res = visit(item, onVisit, depth + 1);
    if (res) {
      return;
    }
  }
};

export const Html: RenderProvider<RenderContext> = {
  finalize: (html, context) => html
    .replace(/(<[/](?:a)>)([A-Za-z0-9$])/g, (_, tag, v) => `${tag} ${v}`)
    .replace(/(<[uo]l>)(<li>)/g, (_, a, b) => `${a} ${b}`),
  For: async ({ recurse, props }) => `{{#${props.value}}}${await recurse()}{{/${props.value}}}`,
  If: async ({ recurse, props }) => `{{#${props.value}}}${await recurse()}{{/${props.value}}}`,
  Unless: async ({ recurse, props }) => `{{^${props.value}}}${await recurse()}{{/${props.value}}}`,
  br: async () => '<br>\n',
  hr: async (el) => `<table ${propsToStr(el.props)}><th></th></table>`,
  strong: stdInline, em: stdInline,
  h1: stdFull, h2: stdFull, h3: stdFull, h4: stdFull,
  li: std, ol: stdFull, ul: stdFull,
  table: stdFull, thead: std, tr: std, td: std, th: std, tbody: std, center: std, img: stdInline,
  title: std,
  div: std, span: stdInline,
  a: async ({ recurse, props }) => `<a ${propsToStr(props)}>${await recurse()}</a>`,

  Title: async ({ recurse, el }) => `<title>${await recurse()}</title>`,
  Summary: async ({ recurse, el }) => `<span id="summary" style="${SUMMARY_STYLE}">${await recurse()}</span>`,

  Column: async ({ props, recurse, el, context }): Promise<string> => {

    recurse();

    let expander = '';

    const kids = getKids(el);
    const colCount = kids.length;

    // Check for sizes. If no attribute is provided, default to small-12. Divide evenly for large columns
    const smallSize = el.props.small ?? colCount;
    const largeSize = el.props.large ?? el.props.small ?? Math.trunc(context.columnCount / colCount);

    // If the column contains a nested row, the .expander class should not be used
    if (largeSize === context.columnCount && !props.noExpander) {
      let hasRow = false;
      visit(el, (node) => {
        if (node.type === 'Row') {
          hasRow = true;
          return true;
        }
      });
      if (!hasRow) {
        expander = '\n<th class="expander"></th>';
      }
    }

    // Final HTML output
    return `
<th ${propsToStr(el.props, `small-${smallSize}`, `large-${largeSize}`, 'columns')}>
  <table>
    <tbody>
      <tr>
        <th>${await recurse()}</th>${expander}
      </tr>
    </tbody>
  </table>
</th>`;
  },

  HLine: async ({ recurse, el }) => `
<table class="${classStr(el.props.class, 'h-line')}">
  <tr><th>&nbsp;</th></tr>
</table>`,

  Row: async ({ recurse, el }): Promise<string> => `
<table ${propsToStr(el.props, 'row')}>
  <tbody>
    <tr>${await recurse()}</tr>
  </tbody>
<!-- $:&zwj; --></table>`,

  Button: async ({ recurse, el, props, createState }): Promise<string> => {
    const { href, target, expanded, ...rest } = props;
    let inner = await recurse();
    let expander = '';

    // If we have the href attribute we can create an anchor for the inner of the button;
    if (href) {
      inner = `<a ${propsToStr({ href, target })}>${inner}</a>`;
    }

    // If the button is expanded, it needs a <center> tag around the content
    if (expanded) {
      const centered = await Html.Center(createState('Center', { children: ['X'] }));
      inner = centered.replace('X', inner);
      expander = '\n<td class="expander"></td>';
    }

    // The .button class is always there, along with any others on the <button> element
    return `
<table ${propsToStr(rest, 'button')}">
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
      ${await Html.Spacer(createState('Spacer', { size: 16 }))}`;
  },

  Container: async ({ recurse, props }): Promise<string> => `
<table align="center" ${propsToStr(props, 'container')}>
  <tbody>
    <tr><td>${await recurse()}</td></tr>
  </tbody>
</table>`,

  BlockGrid: async ({ recurse, props }): Promise<string> => `
<table ${propsToStr(props, 'block-grid', props.up ? `up-${props.up}` : '')}>
  <tbody>
    <tr>${await recurse()}</tr>
  </tbody>
</table>`,

  Menu: async ({ recurse, el, props }): Promise<string> => {
    let hasTableCell = false;
    const kids = getKids(el);
    visit(el, (child) => {
      if (child.type === 'td' || child.type === 'th') {
        return hasTableCell = true;
      }
    });

    let inner = await recurse();

    if (!hasTableCell && kids.length) {
      inner = `<th class="menu-item">${inner}</th>`;
    }

    return `
<table ${propsToStr(props, 'menu')}>
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
  },

  Item: async ({ recurse, props }): Promise<string> => {
    const { href, target, ...parentAttrs } = props;
    return `
       <th ${propsToStr(parentAttrs, 'menu-item')}>
         <a ${propsToStr({ href, target })}>${await recurse()}</a>
       </th>`;
  },

  Center: async ({ recurse, el }): Promise<string> => {
    const kids = getKids(el);
    for (const kid of kids) {
      if (typeof kid.type === 'function') { // We have a component
        Object.assign(kid.props, {
          align: 'center',
          class: classStr(kid.props.class, 'float-center')
        });
      }
    }

    visit(el, child => {
      if (child.type === 'Item') {
        child.props.class = classStr(child.props.class, 'float-center');
      }
      return;
    });

    return `
<center>
  ${await recurse()}
</center>
    `;
  },

  Callout: async ({ recurse, el, props }): Promise<string> => {

    const innerProps: JSXElement['props'] = { class: props.class };
    delete props.class;

    return `
<table ${propsToStr(props), 'callout'}>
  <tbody>
    <tr>
      <th ${propsToStr(innerProps, 'callout-inner')}>
        ${await recurse()}
      </th>
      <th class="expander"></th>
    </tr>
  </tbody>
</table>`;
  },

  Spacer: async ({ props }): Promise<string> => {
    const html: string[] = [];
    const buildSpacer = (size: number | string, extraClass: string = ''): string =>
      `
<table ${propsToStr(props, 'spacer', extraClass)}>
  <tbody>
    <tr>
      <td height="${size}px" style="font-size:${size}px;line-height:${size}px;">&nbsp;</td>
    </tr>
  </tbody>
</table>
      `;

    const sm = props.small ?? undefined;
    const lg = props.large ?? undefined;

    if (sm || lg) {
      if (sm) {
        html.push(buildSpacer(sm, 'hide-for-large'));
      }
      if (lg) {
        html.push(buildSpacer(lg, 'show-for-large'));
      }
    } else {
      html.push(buildSpacer(props.size || 16));
    }

    return html.join('\n');
  },

  Wrapper: async ({ recurse, el }) => `
<table align="center" ${propsToStr(el.props, 'wrapper')}>
  <tbody>
    <tr>
      <td class="wrapper-inner">
        ${await recurse()}
      </td>
    </tr>
  </tbody>
</table>`

};

export const HtmlWrap = (content: string): string => {
  let final = `<!doctype html>
<html>

<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width" />
</head>

<body>
  <table class="body">
    <tr>
      <td class="float-center" align="center" valign="top">
        ${content}
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Get Subject
  const headerTop: string[] = [];
  const bodyTop: string[] = [];

  // Force summary to top, and title to head
  final = final
    .replace(/<title>.*?<\/title>/, a => { headerTop.push(a); return ''; })
    .replace(/<span[^>]+id="summary"[^>]*>(.*?)<\/span>/sm, a => { bodyTop.push(a); return ''; })
    .replace(/<head( [^>]*)?>/, t => `${t}\n${headerTop.join('\n')}`)
    .replace(/<body[^>]*>/, t => `${t}\n${bodyTop.join('\n')}`);

  // Allow tag suffixes/prefixes via comments
  final = final
    .replace(/\s*<!--\s*[$]:([^ ]+)\s*-->\s*(<\/[^>]+>)/g, (_, suf, tag) => `${tag}${suf}`)
    .replace(/(<[^\/][^>]+>)\s*<!--\s*[#]:([^ ]+)\s*-->\s*/g, (_, tag, pre) => `${pre}${tag}`);

  return final;
};