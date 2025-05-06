import { AnyIterable } from './types';

export async function accumulate<T>(iterable: AnyIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of iterable) {
    result.push(item);
  }
  return result;
}
