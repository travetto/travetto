import { JSXElement, isJSXElement } from '@travetto/email-inky/jsx-runtime';

export const getKids = (el: JSXElement): JSXElement[] => {
  const kids = el?.props?.children;
  let result: unknown[] = [];
  if (kids) {
    result = !Array.isArray(kids) ? [kids] : kids;
  }
  return result.filter(isJSXElement);
};

export const visit = (el: JSXElement, onVisit: (fn: JSXElement) => boolean | undefined | void, depth = 0): boolean | undefined => {
  if (depth > 0) {
    const result = onVisit(el);
    if (result === true) {
      return true;
    }
  }
  for (const item of getKids(el)) {
    const result = visit(item, onVisit, depth + 1);
    if (result) {
      return;
    }
  }
};

export const classStr = (existing: string | undefined, ...toAdd: string[]): string => {
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

export const combinePropsToStr = (allowedProps: Set<string>, props: { className?: string } & Record<string, unknown>, addClasses: string[] = []): string => {
  const out = { ...props, className: classStr(props.className, ...addClasses) };
  return Object.entries(out)
    .filter(([k, v]) => allowedProps.has(k) && v !== undefined && v !== null && v !== '')
    .map(([k, v]) => [k === 'className' ? 'class' : k, v])
    .map(([k, v]) => `${k}="${v}"`).join(' ');
};

export const isOfType = (el: JSXElement, type: string): boolean => typeof el.type === 'function' && el.type.name === type;