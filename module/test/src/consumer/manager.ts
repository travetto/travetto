import { Consumer } from '../model/consumer';

import { ConsumerRegistry } from './registry';
import { AllResultsCollector } from './collector';
import './types'; // Load all types

export class ConsumerManager {

  static create(consumer: string | Consumer): Consumer & { summarize?: () => AllResultsCollector } {
    const consumers: Consumer[] = [];

    if (typeof consumer !== 'string') {
      consumers.push(consumer);
    } else {
      const fmtClass = ConsumerRegistry.getOrDefault(consumer);

      if (fmtClass) {
        consumers.push(new fmtClass());
      }
    }

    for (const c of consumers) {
      if (c.onSummary) {
        consumers.unshift(new AllResultsCollector());
        break;
      }
    }

    for (const l of consumers) {
      l.onEvent = l.onEvent.bind(l);
    }

    if (consumers.length === 1) {
      return consumers[0];
    } else {
      const multi: Consumer & { summarize?: () => any } = {
        onStart() {
          for (const c of consumers) {
            if (c.onStart) {
              c.onStart();
            }
          }
        },
        onEvent(e: any) {
          for (const c of consumers) {
            c.onEvent(e);
          }
        }
      };

      if (consumers[0] instanceof AllResultsCollector) {
        const all = consumers[0] as AllResultsCollector;
        multi.summarize = () => {
          for (const c of consumers.slice(1)) {
            if (c.onSummary) {
              c.onSummary(all.summary);
            }
          }
          return all;
        };
      }

      return multi;
    }
  }
}