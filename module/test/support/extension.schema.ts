import { SchemaRegistry, CommonRegExp, FieldConfig } from '@travetto/schema';
import { Class } from '@travetto/registry';

import * as faker from 'faker';

export class TestData {
  static getValue(cfg: FieldConfig, subArray = false) {
    if (!subArray && cfg.declared.array) {
      const min = cfg.minlength ? cfg.minlength.n : 0;
      const max = cfg.maxlength ? cfg.maxlength.n : 20;
      const size = faker.random.number({ min, max });
      const out = [];
      for (let i = 0; i < size; i++) {
        out.push(this.getValue(cfg, true));
      }
    }

    const name = cfg.name.toLowerCase();

    if (cfg.enum) {
      return faker.random.arrayElement(cfg.enum.values)
    }

    const typ = cfg.declared.type;

    if (typ === Number) {
      const min = cfg.min ? cfg.min.n as number : undefined;
      const max = cfg.max ? cfg.max.n as number : undefined;

      if (min !== undefined || max !== undefined) {
        return faker.random.number({ min, max });
      } else {
        if (/(price|amt|amount)$/.test(name)) {
          return faker.finance.amount(min, max);
        }
      }
    } else if (typ === String) {
      const max = cfg.max ? cfg.max.n : undefined;
      const min = cfg.min ? cfg.min.n : undefined;
      const re = cfg.match && cfg.match.re;

      if (re === CommonRegExp.email || /^email(addr(ress)?)?$/.test(name)) {
        return faker.internet.email();
      } else if (re === CommonRegExp.url || /url$/.test(name)) {
        return /(img|image)/.test(name) ? faker.image.imageUrl() : faker.internet.url();
      } else if (re === CommonRegExp.telphone || /^(tele)?phone(num|number)?$/.test(name)) {
        return faker.phone.phoneNumber();
      } else if (re === CommonRegExp.postal_code || /^((postal|zip)code)|zip)$/.test(name)) {
        return faker.address.zipCode();
      } else if (/f(irst)?name/.test(name)) {
        return faker.name.firstName();
      } else if (/l(ast)?name/.test(name)) {
        return faker.name.lastName();
      } else if (/^ip(add(ress)?)?$/.test(name)) {
        return faker.internet.ip();
      } else if (/^ip(add(ress)?)?(v?)6$/.test(name)) {
        return faker.internet.ipv6();
      } else if (/^username$/.test(name)) {
        return faker.internet.userName();
      } else if (/^domain(name)?$/.test(name)) {
        return faker.internet.domainName();
      } else if (/^file(path|name)?$/.test(name)) {
        return faker.system.filePath();
      } else if (/^street(1)?$/i.test(name)) {
        return faker.address.streetAddress(false);
      } else if (name === 'street2') {
        return faker.address.secondaryAddress();
      } else if (name === 'county') {
        return faker.address.county();
      } else if (name === 'country') {
        return faker.address.country();
      } else if (name === 'state') {
        return faker.address.state();
      } else if (/^lon(gitude)/.test(name)) {
        return faker.address.longitude();
      } else if (/^lat(itude)/.test(name)) {
        return faker.address.latitude();
      } else if (/image/.test(name)) {
        if (/profile/.test(name)) {
          return faker.internet.avatar();
        } else {
          return faker.image.image();
        }
      } else if (/^company(name)?$/.test(name)) {
        return faker.company.companyName();
      } else if (/(desc|description)$/.test(name)) {
        return faker.lorem.sentences(10);
      } else {
        return faker.random.word();
      }
    } else if (typ === Date) {

    } else if (typ === Boolean) {
      return faker.random.boolean();
    } else if (SchemaRegistry.has(typ)) {
      return this.generate(typ);
    } else if (cfg.type === 'object') {

    }
  }

  static async generate<T>(cls: Class<T>, view?: string) {
    const cfg = SchemaRegistry.getViewSchema(cls, view);
    const out: { [key: string]: any } = {};

    for (const f of cfg.fields) {
      const fieldConfig = cfg.schema[f];
      if (!fieldConfig.required && (Math.random() < .5)) {
        continue;
      }


    }

    return out;
  }
}