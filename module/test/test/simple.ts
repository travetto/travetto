import { expect } from 'chai';
import { DependencyRegistry } from '@encore/di';
import { Test } from '../src/sample';

describe('suite1', () => {
  it('Test1a', () => {
    expect(2).to.equal(2);
  });
  it('Test1b', () => {
    expect(2).to.equal(2);
  });
});

describe('suite2', () => {
  it('Test2a', () => {
    expect(2).to.equal(2);
  });
  it('Test2b', () => {
    expect(2).to.equal(2);
  });
});


describe('suite3', () => {
  it('Test2a', async () => {
    let inst = await DependencyRegistry.getInstance(Test);
    console.log(inst);
  });
});