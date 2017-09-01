import { Injectable } from '@encore/di';
import { Shutdown } from '@encore/lifecycle';
import * as LRU from 'lru-cache';

export class Cache<T> {
  protected data: LRU.Cache<string, T>;
  protected defaultConfig = {
    max: 1000
  };

  constructor(private shutdown: Shutdown, private config: LRU.Options = {}) {
    shutdown.onShutdown('cache', () => this.cleanup());
    config = Object.assign({}, this.defaultConfig, config || {});
    this.data = LRU(config);
  }

  cleanup() {
    this.data.reset();
  }
}