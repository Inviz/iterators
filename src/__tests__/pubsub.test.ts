import { describe, expect, it, vi } from 'vitest';
import { pubsub } from '../pubsub';

describe.concurrent('pubsub', () => {
  it('should allow publishing and consuming values', async () => {
    const { publish, consume } = pubsub<number>();

    const publishPromise = publish(42);
    const consumePromise = consume();

    const result = await consumePromise;
    await publishPromise;

    expect(result).toBe(42);
  });

  it('should handle publishing before consuming', async () => {
    const { publish, consume } = pubsub<number>();

    const publishPromise = publish(42);
    await new Promise(resolve => setTimeout(resolve, 10));
    const consumePromise = consume();

    const result = await consumePromise;
    await publishPromise;

    expect(result).toBe(42);
  });

  it('should handle multiple publishes with one consumer', async () => {
    const { publish, consume } = pubsub<number>();

    publish(1);
    publish(2);
    publish(3);

    const value1 = await consume();
    const value2 = await consume();
    const value3 = await consume();

    expect(value1).toBe(1);
    expect(value2).toBe(2);
    expect(value3).toBe(3);
  });

  it('should call onStarve when a consumer is waiting', async () => {
    const onStarve = vi.fn();
    const { consume } = pubsub<number>(onStarve);

    const consumePromise = consume();

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(onStarve).toHaveBeenCalled();

    // Clean up the dangling promise
    process.nextTick(() => {
      consumePromise.catch(() => {});
    });
  });

  it('should handle consuming before publishing', async () => {
    const { publish, consume } = pubsub<number>();

    const consumePromise = consume();
    await new Promise(resolve => setTimeout(resolve, 10));
    const publishPromise = publish(42);

    const result = await consumePromise;
    await publishPromise;

    expect(result).toBe(42);
  });

  it('should respect buffer capacity limit', async () => {
    const bufferCapacity = 2;
    const { publish, consume, producing } = pubsub<number>(undefined, bufferCapacity);

    // These should be added to the buffer immediately
    const p1 = publish(1);
    const p2 = publish(2);

    // This should wait until a slot is free
    let p3Started = false;
    const p3Promise = new Promise<void>(resolve => {
      setTimeout(async () => {
        p3Started = true;
        await publish(3);
        resolve();
      }, 0);
    });

    // Buffer should be at capacity
    expect(producing.size).toBe(bufferCapacity);

    // Consume one value to free a slot
    const result1 = await consume();
    expect(result1).toBe(1);

    // Wait for p3 to be processed
    await new Promise(resolve => setTimeout(resolve, 50));

    // p3 should now be in the buffer
    expect(p3Started).toBe(true);

    // Consume remaining values
    const result2 = await consume();
    const result3 = await consume();

    expect(result2).toBe(2);
    expect(result3).toBe(3);

    // Ensure all promises are resolved
    await Promise.all([p1, p2, p3Promise]);
  });

  it('should work with async iterators as values', async () => {
    const { publish, consume } = pubsub<AsyncGenerator<number>>();

    // Create some async generators
    async function* generator1() {
      yield 1;
      yield 2;
    }

    async function* generator2() {
      yield 3;
      yield 4;
    }

    // Publish async generators
    publish(generator1());
    publish(generator2());

    // Consume the async generators
    const asyncIterator1 = await consume();
    const asyncIterator2 = await consume();

    // Verify values from the first iterator
    let result = await asyncIterator1.next();
    expect(result.value).toBe(1);
    result = await asyncIterator1.next();
    expect(result.value).toBe(2);
    result = await asyncIterator1.next();
    expect(result.done).toBe(true);

    // Verify values from the second iterator
    result = await asyncIterator2.next();
    expect(result.value).toBe(3);
    result = await asyncIterator2.next();
    expect(result.value).toBe(4);
    result = await asyncIterator2.next();
    expect(result.done).toBe(true);
  });

  it('should block publishers when buffer is full', async () => {
    const bufferCapacity = 2;
    const { publish, consume, producing } = pubsub<number>(undefined, bufferCapacity);

    // Track which generators get processed first
    const processingOrder: string[] = [];

    // Start multiple publish operations almost simultaneously
    // to test how the buffer capacity controls the flow
    const promises = [];

    // This should execute immediately and be added to buffer
    promises.push(
      (async () => {
        processingOrder.push('start-1');
        await publish(1);
        processingOrder.push('end-1');
      })()
    );

    // This should also execute immediately and be added to buffer
    promises.push(
      (async () => {
        processingOrder.push('start-2');
        await publish(2);
        processingOrder.push('end-2');
      })()
    );

    // Buffer is now at capacity, this should wait
    promises.push(
      (async () => {
        processingOrder.push('start-3');
        await publish(3);
        processingOrder.push('end-3');
      })()
    );

    // Buffer is now at capacity, this should wait
    promises.push(
      (async () => {
        processingOrder.push('start-4');
        await publish(4);
        processingOrder.push('end-4');
      })()
    );

    // At this point, only the first two operations should have started
    expect(producing.size).toBe(bufferCapacity);
    expect(processingOrder).toContain('start-1');
    expect(processingOrder).toContain('start-2');
    expect(processingOrder).not.toContain('end-3');

    // Consume some values to free up buffer space
    expect(await consume()).toBe(1);

    // Now the third operation should be in progress
    expect(processingOrder).toContain('start-3');
    expect(processingOrder).toContain('end-3');
    expect(processingOrder).toContain('start-4');
    expect(processingOrder).not.toContain('end-4');

    await consume();
    expect(processingOrder).toContain('start-4');
    expect(processingOrder).toContain('end-4');

    promises.push(
      (async () => {
        processingOrder.push('start-5');
        await publish(5);
        processingOrder.push('end-5');
      })()
    );
    expect(processingOrder).not.toContain('end-5');
    await consume();
    expect(processingOrder).toContain('end-5');
  });

  it('should handle promises in iterators by resolving them in order of completion', async () => {
    const { publish, consume } = pubsub<Promise<number>>();

    // Create promises that resolve at different times
    const slow = new Promise<number>(resolve => setTimeout(() => resolve(1), 100));
    const fast = new Promise<number>(resolve => setTimeout(() => resolve(2), 10));
    const medium = new Promise<number>(resolve => setTimeout(() => resolve(3), 50));

    // Publish the promises in order: slow, fast, medium
    publish(slow);
    publish(fast);
    publish(medium);

    // Consume the promises - they should be resolved in order of completion
    // Fast (10ms) should resolve first, then medium (50ms), then slow (100ms)
    const value1 = await consume(); // Should be 2 (fast)
    const value2 = await consume(); // Should be 3 (medium)
    const value3 = await consume(); // Should be 1 (slow)

    // Values should come in order of resolution, not enqueue order
    expect(value1).toBe(2); // Fast promise resolves first
    expect(value2).toBe(3); // Medium promise resolves second
    expect(value3).toBe(1); // Slow promise resolves last
  });
});
