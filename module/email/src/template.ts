import * as inlineCss from 'inline-css';
import * as inky from 'inky';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';
import * as PngQuant from 'pngquant';
import * as htmlEntities from 'html-entities';
import toMarkdown from 'to-markdown';
import * as sass from 'node-sass';
import * as util from 'util';

const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);
const mkdir = util.promisify(fs.mkdir);

const Inky = inky.Inky;

export const assetRoot = `${__dirname}/assets`;
export const distRoot = path.resolve(`${__dirname}/../dist`);

const scssRoot = `${assetRoot}/scss`;
const distAssetRoot = `${distRoot}/assets`;
const srcFile = path.resolve(process.argv[2]);
const srcDir = path.dirname(srcFile);

const allEntities = new htmlEntities.AllHtmlEntities();

export async function init() {
  try {
    await mkdir(distRoot);
  } catch (e) { }

  try {
    await mkdir(distAssetRoot);
  } catch (e) { }

  return {
    src: srcFile
  }
}

export function toText(html) {

  function getAttrs(node) {
    const attrs = {};
    for (let i = 0; i < node.attributes.length; i++) {
      const attr = node.attributes.item(i);
      attrs[attr.localName] = attr.value;
    }
    return attrs;
  }

  // Cleanup html from templating
  let simple = html
    .replace(/<table[^>]*spacer[^>]*>.*?<\/table>/g, x => { // Turn spacers into <br>
      const height = parseInt(x.split('font-size:')[1].split(';')[0].trim().replace('px', ''), 10);
      return '<br>'.repeat(Math.ceil(height / 16));
    })
    .replace(/<div class="hr[^>]+>/g, '<hr>')
    .replace(/<[/]?(table|tr|th|thead|tbody|td|center|span|div|img)[^>]*>/g, '') // Remove purely structuring tags
    .replace(/&#xA0;/g, ' ') // Remove entities
    .replace(/style="[^"]+"/g, ''); // Remove all style tags

  // Decode all encoded pieces
  simple = allEntities.decode(simple);

  const text = toMarkdown(simple, {
    gfm: true,
    converters: [
      {
        filter: 'small',
        replacement: v => `*${v}*`
      },
      {
        filter: 'hr',
        replacement: x => `\n\n-------------------\n\n`
      },
      {
        filter: 'a',
        replacement: (x, node) => {
          const attrs = getAttrs(node)
          const href = attrs['href'];
          return `[${x}]( ${href} )`
        }
      }]
  });

  return text;
}

export async function toHtml(tpl: string) {
  // Compile SASS
  const css = sass.renderSync({
    file: `${scssRoot}/app.scss`,
    includePaths: [scssRoot, 'node_modules/foundation-emails/scss']
  });

  const wrapper = (await readFile(`${assetRoot}/wrapper.html`)).toString();

  await writeFile(`${distAssetRoot}/app.css`, css.css, 'utf8');

  tpl = tpl
    .replace(/<\/button>/g, (all) => `${all}<spacer size="16"></spacer>`) // Insert spacers
    .replace(/<hr[^>]*>/g, (a, e) => { // Turn <hr> to <div class="hr">
      const classes = ['hr']
      const woClasses = a.replace(/class="([^"]*)"/g, (b, c) => { classes.push(c); return ''; });
      return a
        .replace(/<hr/, `<div class="${classes.join(' ')}"`)
        .replace(/[/]?>/, '></div>');
    }); // Pull out hrs

  // Wrap template, with preamble/postamble
  tpl = wrapper
    .replace('<!-- BODY -->', tpl)
    .replace(/%WIDTH%/g, `580`);

  let html = new Inky().releaseTheKraken(tpl) as string;

  // Extract CSS
  html = await inlineCss(html, {
    preserveImportant: true,
    url: `file://${distRoot}/`
  } as any);

  const pendingImages = [];

  html.replace(/(<img[^>]src=")([^"]+)/g, (a: string, pre: string, src: string) => { // Inline base64 images
    const newSrc = src.startsWith('assets/images') ? `${__dirname}/${src}` : `${srcDir}/${src}`;
    const ext = path.extname(newSrc).split('.')[1];
    const bufs = [];

    pendingImages.push(new Promise((resolve, reject) => {
      const stream = fs.createReadStream(newSrc).pipe(new PngQuant([128]));
      stream.on('data', d => bufs.push(d));
      stream.on('end', err => {
        if (err) {
          reject(err);
        } else {
          resolve({ ext, data: Buffer.concat(bufs).toString('base64'), src });
        }
      });
    }));
    return '';
  });

  const images = await Promise.all(pendingImages);
  const imageMap = {};
  images.forEach(x => imageMap[x.src] = x)

  html = html.replace(/<(meta|img|link|hr|br)[^>]*>/g, a => a.replace('>', '/>')) // Fix self closing
    .replace(/&apos;/g, '&#39;') // Fix apostrophes, as outlook hates them
    .replace(/(background(?:-color)?:\s*)([#0-9a-fA-F]+)([^>]+)>/g, (all, p, col, rest) => `${p}${col}${rest} bgcolor="${col}">`) // Inline bg-color
    .replace(/<([^>]+vertical-align:\s*(top|bottom|middle)[^>]+)>/g,
      (a, tag, valign) => tag.indexOf('valign') ? `<${tag}>` : `<${tag} valign="${valign}">`) // Vertically align if it has the style
    .replace(/<(table[^>]+expand[^>]+width:\s*)(100%\s+!important)([^>]+)>/g, (a, left, size, right) => `<${left}100%${right}>`) // Drop important as a fix for outlook
    .replace(/(<img[^>]src=")([^"]+)/g, (a, pre, src) => { // Inline base64 images
      const { ext, data } = imageMap[src];
      return `${pre}data:image/${ext};base64,${data}`;
    })

  return html;
}

export async function template(templateFile) {
  try {
    console.log(`Compiling ${templateFile}...`);
    const tpl = (await readFile(templateFile)).toString();

    const html = await toHtml(tpl);
    await writeFile(templateFile.replace(/.tpl$/, '.html'), html);

    const text = toText(html);
    await writeFile(templateFile.replace(/.tpl$/, '.txt'), text);

    return { html, text };
  } catch (e) {
    console.log('Error', e);
    throw e;
  }
}