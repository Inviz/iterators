import { Series } from './concurrent';
import { pubsub } from './pubsub';

/**
 * Processes multiple async iterables concurrently,
 * yielding values as they become available from any iterator.
 * Limits the number of concurrent iterators being processed.
 *
 * @param inputConcurrency Maximum number of iterators to process concurrently
 * @param outputConcurrency Maximum number of values that can be buffered before consumption
 * @param iterators An iterable of AsyncGenerators to process
 */
async function* _race<T>(
  inputConcurrency: number = Infinity,
  outputConcurrency: number = inputConcurrency,
  iterators: Series<AsyncGenerator<T>>,
  isLazy: boolean = false
): AsyncGenerator<T> {
  type R = { item: T; iterator: AsyncGenerator<T> };

  // Use pubsub to control output values
  console.time('race');
  const { publish, consume, producing } = pubsub<R>(undefined, outputConcurrency);

  let inputsExhausted = false;
  // track how many items have been published but not consumed for each iterator
  const counters = new Map<AsyncGenerator<T>, number>();
  const active = new Set<AsyncGenerator<T>>();

  /** Track how many items have been published but not consumed for an iterator */
  function countBufferedValues(iterator: AsyncGenerator<T>, diff: number) {
    const updated = (counters.get(iterator) || 0) + diff;
    if (updated == 0) {
      counters.delete(iterator);
    } else {
      counters.set(iterator, updated);
    }
    return updated;
  }

  /** How many iterators are currently not fully consmed? */
  function countActiveIterators() {
    let count = counters.size;
    for (const iterator of active) {
      if (!counters.has(iterator)) {
        count += 1;
      }
    }
    return count;
  }

  let onNextIterator: (() => void) | undefined;

  // Process a single iterator until it's exhausted
  async function readIterator(iterator: AsyncGenerator<T>) {
    const id = `race-iterator-${active.size + 1}`;
    console.time(id);
    console.timeLog(id, 'Processing iterator');

    try {
      active.add(iterator);
      for await (const item of iterator) {
        countBufferedValues(iterator, +1);
        console.timeLog(id, 'Publishing value:', item);
        await publish({ item, iterator });
        console.timeLog(id, 'Published value:', item);
      }
    } finally {
      active.delete(iterator);
      console.timeLog(id, 'Iterator exhausted');
    }
  }

  // Consume iterators up to concurrency limit
  (async () => {
    try {
      // Collect and process iterators
      let i = 0;
      for await (const iterator of iterators) {
        i++;
        const id = `race-iterator-${i}`;
        console.time(id);
        console.timeLog(id, 'New iterator available', countActiveIterators());
        if (countActiveIterators() >= inputConcurrency) {
          console.timeLog(id, 'WAITING FOR NEXT ITERATOR');
          await new Promise<void>(resolve => {
            onNextIterator = resolve;
          });
          console.timeLog(id, 'Unblocked FOR NEXT ITERATOR');
        }

        console.timeLog(id, ' ITERATORS', counters.size);
        readIterator(iterator);
      }

      console.timeLog('race', 'All input iterators exhausted', i);
    } finally {
      inputsExhausted = true;
    }
  })();

  // exit quickly if there are not inputs

  await new Promise(setImmediate);
  console.log('loop', inputsExhausted, counters.size, producing.size);
  // Give a chance for state to update
  // Yield values until all iterators are done
  while (!(inputsExhausted && active.size === 0 && counters.size === 0 && producing.size === 0)) {
    console.timeLog(
      'race',
      'Consuming output, active iterators:',
      counters.size,
      'inputs exhausted:',
      inputsExhausted,
      Array.from(counters.entries())
    );
    const { item, iterator } = await consume();
    console.timeLog('race', 'Yielding value:', item);

    if (countBufferedValues(iterator, -1) == 0 && !active.has(iterator)) {
      console.timeLog('race', 'Unblocking next iterator', onNextIterator);
      onNextIterator?.();
    }
    console.log(inputsExhausted, active.size, counters.size, producing.size);

    yield item;
  }
}

/**
 * Creates a function that processes multiple async iterables concurrently,
 * yielding values as they become available from any iterator
 */
export namespace race {
  export function async<T>(
    inputConcurrency: number,
    outputConcurrency: number,
    iterators: Series<AsyncGenerator<T>>
  ): AsyncGenerator<T>;
  export function async<T>(
    inputConcurrency: number,
    outputConcurrency?: number
  ): (iterators: Series<AsyncGenerator<T>>) => AsyncGenerator<T>;
  export function async<T>(
    inputConcurrency: number,
    outputConcurrency: number = Infinity,
    iterators?: Series<AsyncGenerator<T>>
  ): AsyncGenerator<T> | ((iterators: Series<AsyncGenerator<T>>) => AsyncGenerator<T>) {
    if (iterators === undefined) {
      return (iters: Series<AsyncGenerator<T>>) =>
        _race(inputConcurrency, outputConcurrency, iters);
    }
    return _race(inputConcurrency, outputConcurrency, iterators);
  }
}
