import { pubsub } from './lib/pubsub';
import { AnyIterable } from './types';

/**
 * Simple concating of nested iterables when no true concurrency is needed
 *
 * @param iterators An iterable of AsyncGenerators to process sequentially
 */
async function* _concat<T>(iterators: AnyIterable<AnyIterable<T>>): AsyncGenerator<T> {
  for await (const iterator of iterators) {
    for await (const item of iterator) {
      yield item;
    }
  }
}

/**
 * Processes multiple async iterables concurrently,
 * yielding values as they become available from any iterator.
 * Limits the number of concurrent iterators being processed.
 *
 * @param inputConcurrency Maximum number of iterators to process concurrently
 * @param outputConcurrency Maximum number of values that can be buffered before consumption
 * @param iterators An iterable of AsyncGenerators to process
 */
async function* _concatConcurrently<T>(
  inputConcurrency: number = Infinity,
  outputConcurrency: number = inputConcurrency,
  iterators: AnyIterable<AnyIterable<T>>,
  isLazy: boolean = false
): AsyncGenerator<T> {
  type R = { item: T; iterator: AnyIterable<T> };

  // Use pubsub to control output values
  // % console.time('race');
  const { publish, consume, producing } = pubsub<R>(outputConcurrency);

  let inputsExhausted = false;
  // track how many items have been published but not consumed for each iterator
  const counters = new Map<AnyIterable<T>, number>();
  const active = new Set<AnyIterable<T>>();

  /** Track how many items have been published but not consumed for an iterator */
  function countBufferedValues(iterator: AnyIterable<T>, diff: number) {
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
  async function readIterator(iterator: AnyIterable<T>) {
    const id = `race-iterator-${active.size + 1}`;
    // %console.time(id);
    // %console.timeLog(id, 'Processing iterator', iterator);

    try {
      active.add(iterator);
      // % console.log('iterate this thing');
      for await (const item of iterator) {
        countBufferedValues(iterator, +1);
        // % console.timeLog(id, 'Publishing value:', item);
        await publish({ item, iterator });
        // % console.timeLog(id, 'Published value:', item);
      }
    } finally {
      active.delete(iterator);
      // % console.timeLog(id, 'Iterator exhausted');
      nextIteratorIfNeeded(iterator);
    }
  }

  function nextIteratorIfNeeded(iterator: AnyIterable<T>) {
    if (
      onNextIterator &&
      !active.has(iterator) &&
      countBufferedValues(iterator, 0) == 0 &&
      producing.size < outputConcurrency
    ) {
      //console.log('iterate this thing!', counters.size, active.size, producing.size);
      // % console.log('iterate this thing', producing.size, outputConcurrency);
      onNextIterator();
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
        // % console.time(id);
        // % console.timeLog(id, 'New iterator available', countActiveIterators(), iterator);
        if (countActiveIterators() >= inputConcurrency) {
          // % console.timeLog(id, 'WAITING FOR NEXT ITERATOR');
          await new Promise<void>(resolve => {
            onNextIterator = resolve;
          });
          // % console.timeLog(id, 'Unblocked FOR NEXT ITERATOR');
        }

        // % console.timeLog(id, ' ITERATORS', counters.size);
        readIterator(iterator);
      }

      // % console.timeLog('race', 'All input iterators exhausted', i);
    } finally {
      inputsExhausted = true;
    }
  })();

  // exit quickly if there are not inputs

  await new Promise(setImmediate);
  // % console.log('loop', inputsExhausted, counters.size, producing.size);
  // Give a chance for state to update
  // Yield values until all iterators are done
  while (!(inputsExhausted && active.size === 0 && counters.size === 0 && producing.size === 0)) {
    // %console.timeLog(
    // %  'race',
    // %  `active iterators: ${counters.size}, inputs exhausted: ${inputsExhausted}`
    // %);
    // %
    const { item, iterator } = await consume();

    countBufferedValues(iterator, -1);
    nextIteratorIfNeeded(iterator);

    yield item;
  }
}

export function concat<T>(
  inputs: AnyIterable<AnyIterable<T>>,
  inputConcurrency: number,
  outputConcurrency?: number
): AsyncGenerator<T>;
/**
 * Creates a function that processes multiple async iterables concurrently,
 * yielding values as they become available from any iterator
 */
export function concat<T>(
  inputConcurrency: number,
  outputConcurrency?: number
): (iterators: AnyIterable<AnyIterable<T>>) => AsyncGenerator<T>;

export function concat<T>(
  inputs: AnyIterable<AnyIterable<T>> | number,
  inputConcurrency?: any,
  outputConcurrency?: any
) {
  if (typeof inputs === 'number') {
    return (iterators: AnyIterable<AnyIterable<T>>) => concat(iterators, inputs, inputConcurrency);
  } else if ((inputConcurrency === 1 && outputConcurrency === 1) || inputConcurrency == undefined) {
    return _concat(inputs);
  } else {
    return _concatConcurrently(inputConcurrency, outputConcurrency || Infinity, inputs);
  }
}
