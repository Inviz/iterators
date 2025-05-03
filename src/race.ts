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
  iterators: Series<AsyncGenerator<T>>
): AsyncGenerator<T> {
  // Use pubsub to control output values
  const { publish, consume } = pubsub<T>(undefined, outputConcurrency);

  let activeIterators = 0;
  let inputsExhausted = false;
  const iteratorQueue: AsyncGenerator<T>[] = [];

  // Start iterators up to concurrency limit
  async function consumeIterators() {
    while (activeIterators < inputConcurrency && iteratorQueue.length > 0) {
      const iterator = iteratorQueue.shift();
      if (iterator) {
        processIterator(iterator);
      }
    }
  }

  // Process a single iterator until it's exhausted
  async function processIterator(iterator: AsyncGenerator<T>) {
    activeIterators++;
    console.log('Processing iterator, active count:', activeIterators);

    try {
      for await (const item of iterator) {
        console.log('Publishing value:', item);
        await publish(item);
      }
    } finally {
      activeIterators--;
      console.log('Iterator completed, active count:', activeIterators);

      // Start a new iterator when one completes
      consumeIterators();
    }
  }

  // Consume iterators up to concurrency limit
  (async () => {
    try {
      // Collect and process iterators
      for await (const iterator of iterators) {
        console.log('New iterator available');
        iteratorQueue.push(iterator);
        await consumeIterators();
      }

      console.log('All input iterators exhausted');
    } finally {
      inputsExhausted = true;
    }
  })();

  // exit quickly if there are not inputs
  await new Promise(setImmediate);

  // Give a chance for state to update
  // Yield values until all iterators are done
  while (!(inputsExhausted && activeIterators === 0)) {
    console.log(
      'Consuming output, active iterators:',
      activeIterators,
      'inputs exhausted:',
      inputsExhausted
    );
    const value = await consume();
    console.log('Yielding value:', value);
    yield value;
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
    outputConcurrency: number = inputConcurrency,
    iterators?: Series<AsyncGenerator<T>>
  ): AsyncGenerator<T> | ((iterators: Series<AsyncGenerator<T>>) => AsyncGenerator<T>) {
    if (iterators === undefined) {
      return (iters: Series<AsyncGenerator<T>>) =>
        _race(inputConcurrency, outputConcurrency, iters);
    }
    return _race(inputConcurrency, outputConcurrency, iterators);
  }
}
