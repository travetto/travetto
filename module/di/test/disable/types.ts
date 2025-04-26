import { Injectable, InjectableFactory } from '@travetto/di';

@Injectable({ enabled: false })
export class MyCustomClass {

}

@Injectable({ enabled: true })
export class MyCustomClass2 {

}

export class MyCustomClass3 { }
export class MyCustomClass4 { }

class Factory {
  @InjectableFactory({ enabled: () => false })
  static getCustomClass3(): MyCustomClass {
    return new MyCustomClass();
  }

  @InjectableFactory({ enabled: () => true })
  static getCustomClass4(): MyCustomClass2 {
    return new MyCustomClass2();
  }

  @InjectableFactory({ enabled: () => process.env.NAME !== 'test' })
  static getCustomClass5(): MyCustomClass3 {
    return new MyCustomClass3();
  }

  @InjectableFactory({ enabled: () => process.env.NAME === 'test' })
  static getCustomClass6(): MyCustomClass4 {
    return new MyCustomClass4();
  }
}
