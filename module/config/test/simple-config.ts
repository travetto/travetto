import { Config, ConfigLoader } from '../src';
import { Inject, Injectable } from '@encore/di';

class DbConfig {
  name: string;
  connection: string;
  hosts: string[];
}

@Config('db.mysql', DbConfig, 'db')
class TestConfig extends DbConfig {

}