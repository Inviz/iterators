import { writer } from './lib/writer';
import { map } from './map';
import { AnyIterable, MaybePromise } from './types';

/**
 * Partition function takes a splitter function and multiple processors.
 * The splitter function splits each input item into a tuple of parts.
 * Items returned from splitter get routed to processors by index
 *
 * Backpressure is provided both by downstream steps and by branching steps.
 *
 * @param splitter Function that splits each input item into a tuple
 * @param processors Processing functions, one for each position in the tuple
 * @returns A function that takes an iterable input and returns processed results
 */
export async function* _dispatch<T, A, B, C, D, AA, BB, CC, DD>(
  iterator: AnyIterable<T>,
  splitter: (item: T) => MaybePromise<[a?: A, b?: B, c?: C, d?: D]>,
  a?: (input: AnyIterable<A>) => AnyIterable<AA>,
  b?: (input: AnyIterable<B>) => AnyIterable<BB>,
  c?: (input: AnyIterable<C>) => AnyIterable<CC>,
  d?: (input: AnyIterable<D>) => AnyIterable<DD>,
  concurrency?: number
): AsyncGenerator<T> {
  const pushA = a ? writer(a, concurrency)?.write : undefined;
  const pushB = b ? writer(b, concurrency)?.write : undefined;
  const pushC = c ? writer(c, concurrency)?.write : undefined;
  const pushD = d ? writer(d, concurrency)?.write : undefined;

  return map(
    iterator,
    async item => {
      const [a, b, c, d] = await splitter(item);

      await Promise.all([
        a ? pushA?.(a) : undefined,
        b ? pushB?.(b) : undefined,
        c ? pushC?.(c) : undefined,
        d ? pushD?.(d) : undefined,
      ]);

      // yield item back to allow downstream to control the consumption
      return item;
    },
    concurrency
  );
}

export function dispatch<T, A, B, C, D, AA, BB, CC, DD>(
  iterator: AnyIterable<T>,
  splitter: (item: T) => MaybePromise<[a?: A, b?: B, c?: C, d?: D]>,
  a?: (input: AnyIterable<A>) => AnyIterable<AA>,
  b?: (input: AnyIterable<B>) => AnyIterable<BB>,
  c?: (input: AnyIterable<C>) => AnyIterable<CC>,
  d?: (input: AnyIterable<D>) => AnyIterable<DD>,
  concurrency?: number
): AsyncGenerator<T>;

export function dispatch<T, A, B, C, D, AA, BB, CC, DD>(
  splitter: (item: T) => MaybePromise<[a?: A, b?: B, c?: C, d?: D]>,
  a?: (input: AnyIterable<A>) => AnyIterable<AA>,
  b?: (input: AnyIterable<B>) => AnyIterable<BB>,
  c?: (input: AnyIterable<C>) => AnyIterable<CC>,
  d?: (input: AnyIterable<D>) => AnyIterable<DD>,
  concurrency?: number
): (iterator: AnyIterable<T>) => AsyncGenerator<T>;

export function dispatch<T>(
  input: any,
  splitter: any,
  a: any,
  b: any,
  c: any,
  d: any,
  concurrency?: any
) {
  if (typeof input === 'function') {
    return (_input: AnyIterable<T>) => dispatch(_input, input, splitter, a, b, c, d);
  } else {
    return _dispatch(input, splitter, a, b, c, d, concurrency);
  }
}
