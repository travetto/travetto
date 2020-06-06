import { InkyComponentFactory } from './factory';

/**
 * Inky factory entry
 */
export class Inky {
  static defaultFactory = new InkyComponentFactory();

  /**
   * Render markdown to HTML
   * @param text Text to convert
   * @param factory Optional component factory, default is the inky set
   */
  static render(text: string, factory?: InkyComponentFactory) {
    factory = factory ?? this.defaultFactory;
    // Extract raws
    const raws: string[] = [];
    const html = text.replace(/\< *raw *\>(.*?)\<\/ *raw *\>/gi, (all, inner) => raws.push(inner) ? `###RAW${raws.length - 1}###` : '');

    let out = factory.render(html);

    // Take care of various minor fixes
    out = out
      .replace(/<(meta|img|link|hr|br)[^>]*>/g, a => a.replace('>', '/>')) // Fix self closing
      .replace(/&apos;/g, '&#39;') // Fix apostrophes, as outlook hates them
      .replace(/(background(?:-color)?:\s*)([#0-9a-fA-F]+)([^>]+)>/g,
        (all, p, col, rest) => `${p}${col}${rest} bgcolor="${col}">`) // Inline bg-color
      .replace(/<([^>]+vertical-align:\s*(top|bottom|middle)[^>]+)>/g,
        (a, tag, valign) => tag.indexOf('valign') ? `<${tag}>` : `<${tag} valign="${valign}">`) // Vertically align if it has the style
      .replace(/<(table[^>]+expand[^>]+width:\s*)(100%\s+!important)([^>]+)>/g,
        (a, left, size, right) => `<${left}100%${right}>`); // Drop important as a fix for outlook;

    // Re-inject raws
    const res = out
      .replace(/###RAW(\d+)###/g, (all, i) => raws[parseInt(i, 10)]);

    return res;
  }
}