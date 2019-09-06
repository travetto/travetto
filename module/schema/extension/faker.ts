import * as faker from 'faker';

import { Class } from '@travetto/registry';

import { CommonRegExp } from '../src/validate/regexp';
import { FieldConfig } from '../src/service/types';
import { SchemaRegistry } from '../src/service/registry';
import { BindUtil } from '../src/bind-util';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const between = (fromDays: number, toDays: number) => {
  return faker.date.between(
    new Date(Date.now() + fromDays * DAY_IN_MS),
    new Date(Date.now() + toDays * DAY_IN_MS)
  );
};

export class SchemaFakerUtil {
  static STRING_RE_TO_TYPE: [RegExp, () => any][] = [
    [CommonRegExp.email, faker.internet.email],
    [CommonRegExp.url, faker.internet.url],
    [CommonRegExp.telephone, faker.phone.phoneNumber],
    [CommonRegExp.postal_code, faker.address.zipCode]
  ];

  static NAMES_TO_TYPE: Record<string, [RegExp, () => any][]> = {
    string: [
      [/^(image|img).*url$/, faker.image.imageUrl],
      [/^url$/, faker.internet.url],
      [/^email(addr(ress)?)?$/, faker.internet.email],
      [/^(tele)?phone(num|number)?$/, faker.phone.phoneNumber],
      [/^((postal|zip)code)|zip$/, faker.address.zipCode],
      [/f(irst)?name/, faker.name.firstName],
      [/l(ast)?name/, faker.name.lastName],
      [/^ip(add(ress)?)?$/, faker.internet.ip],
      [/^ip(add(ress)?)?(v?)6$/, faker.internet.ipv6],
      [/^username$/, faker.internet.userName],
      [/^domain(name)?$/, faker.internet.domainName],
      [/^file(path|name)?$/, faker.system.filePath],
      [/^street(1)?$/, faker.address.streetAddress],
      [/^street2$/, faker.address.secondaryAddress],
      [/^county$/, faker.address.county],
      [/^country$/, faker.address.country],
      [/^state$/, faker.address.state],
      [/^lon(gitude)/, faker.address.longitude],
      [/^lat(itude)/, faker.address.latitude],
      [/(profile).*(image|img)/, faker.image.avatar],
      [/(image|img)/, faker.image.image],
      [/^company(name)?$/, faker.company.companyName],
      [/(desc|description)$/, () => faker.lorem.sentences(10)]
    ],
    date: [
      [/dob|birth/, () => faker.date.past(60)],
      [/creat(e|ion)/, () => between(-200, -100)],
      [/(update|modif(y|ied))/, () => between(-100, -50)]
    ]
  };

  static getArrayValue(cfg: FieldConfig) {
    const min = cfg.minlength ? cfg.minlength.n : 0;
    const max = cfg.maxlength ? cfg.maxlength.n : 10;
    const size = faker.random.number({ min, max });
    const out = [];
    for (let i = 0; i < size; i++) {
      out.push(this.getValue(cfg, true));
    }
    return out;
  }

  static getNumberValue(cfg: FieldConfig) {
    let min = cfg.min ? cfg.min.n as number : undefined;
    let max = cfg.max ? cfg.max.n as number : undefined;
    let precision = cfg.precision;

    const name = cfg.name.toUpperCase();

    if (/(price|amt|amount)$/.test(name)) {
      precision = [13, 2];
    }

    let offset = 1;

    if (precision !== undefined) {
      min = min === undefined ? -((10 ** precision[0]) - 1) : min;
      max = max === undefined ? ((10 ** precision[0]) - 1) : max;
      if (precision[1] !== undefined) {
        offset = (10 ** (precision[1] || 0));
      }
    }

    max = max === undefined ? 1000 : max;
    min = min === undefined ? 0 : min;

    const range = (max - min) * offset;

    const val = Math.trunc(Math.random() * range);

    return (val / offset) + min;
  }

  static getDateValue(cfg: FieldConfig) {
    const name = cfg.name.toUpperCase();
    const min = cfg.min ? cfg.min.n as Date : undefined;
    const max = cfg.max ? cfg.max.n as Date : undefined;

    if (min !== undefined || max !== undefined) {
      return faker.date.between(min || new Date(Date.now() - (50 * DAY_IN_MS)), max || new Date());
    } else {
      for (const [re, fn] of this.NAMES_TO_TYPE.date) {
        if (re.test(name)) {
          return fn();
        }
      }
      return faker.date.recent(50);
    }
  }

  static getStringValue(cfg: FieldConfig) {
    const name = cfg.name.toLowerCase();

    if (cfg.match) {
      const mre = cfg.match && cfg.match.re;
      for (const [re, fn] of this.STRING_RE_TO_TYPE) {
        if (mre === re) {
          return fn();
        }
      }
    }

    for (const [re, fn] of this.NAMES_TO_TYPE.string) {
      if (re.test(name)) {
        return fn();
      }
    }

    return faker.random.word();
  }

  static getValue(cfg: FieldConfig, subArray = false): any {
    if (!subArray && cfg.array) {
      return this.getArrayValue(cfg);
    } else if (cfg.enum) {
      return faker.random.arrayElement(cfg.enum.values);
    } else {

      const typ = cfg.type;

      if (typ === Number) {
        return this.getNumberValue(cfg);
      } else if (typ === String) {
        return this.getStringValue(cfg);
      } else if (typ === Date) {
        return this.getDateValue(cfg);
      } else if (typ === Boolean) {
        return faker.random.boolean();
      } else if (SchemaRegistry.has(typ)) {
        return this.generate(typ);
      }
    }
  }

  static generate<T>(cls: Class<T>, view?: string) {
    const cfg = SchemaRegistry.getViewSchema(cls, view);
    const out: Record<string, any> = {};

    for (const f of cfg.fields) {
      const fieldConfig = cfg.schema[f];
      if (!fieldConfig.required && (Math.random() < .5)) {
        continue;
      }
      out[f] = this.getValue(fieldConfig);
    }

    return BindUtil.bindSchema(cls, out, view);
  }
}