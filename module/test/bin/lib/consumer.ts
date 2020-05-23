import * as readline from 'readline';
import { ColorUtil } from '@travetto/boot';
import { Colors } from '@travetto/cli/src/color';
import type { TestEvent } from '../../src/model/event';

export async function getTapConsumer() {
  const { TapEmitter } = await import('../../src/consumer/types/tap');
  if (ColorUtil.colorize) {
    return new TapEmitter(process.stdout, {
      assertDescription: Colors.description,
      testDescription: Colors.description,
      success: Colors.success,
      failure: Colors.failure,
      assertNumber: Colors.identifier,
      testNumber: Colors.identifier,
      assertFile: Colors.path,
      assertLine: Colors.input,
      objectInspect: Colors.output,
      suiteName: Colors.subtitle,
      testName: Colors.title,
      total: Colors.title
    });
  } else {
    return new TapEmitter(process.stdout);
  }
}

export function eventStreamSource(input: NodeJS.ReadableStream, onEvent: (name: string, event: TestEvent) => void, onComplete: () => void) {

  const rl = readline.createInterface({
    input,
    output: process.stdout,
    terminal: false
  });

  rl
    .on('line', function (line) {
      const space = line.indexOf(' ');
      const body = line.substring(space + 1).trim();
      const name = line.substring(0, space - 1);

      let event: TestEvent | undefined;
      try {
        event = JSON.parse(body);
      } catch {
        console.error('Failed on', body);
      }

      if (event) {
        onEvent(name, event);
      }
    })
    .on('close', () => {
      onComplete();
    });
}