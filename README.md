# @augceo/iterators

Concurrent iterator utilities for working with async generators in JavaScript/TypeScript.

- Enables efficient parallel IO operations
- Works with any iterable source (arrays, async generators, streams)
- Creates strongly-typed async processing pipelines
- Computes values on-demand with lazy evaluation
- Gives precise control over concurrency limits and buffer sizes
- Includes ready-made tools for batching and stream multiplexing
- Optimizes throughput for constrained resources like DB connections
- Respects back-pressure end-to-end, allowing slower steps throttle consumption
- Intuitive ergonomics - streamed code looks like synchronous code

## Installation

```bash
npm install @augceo/iterators
```

## Usage

```typescript
import * as I from '@augceo/iterators';

// Create a pipeline with concurrent processing
const pipeline = I.pipe(
  [getDataSource(), getDataSource(), getDatasource()],
  I.concat(2, 4), // process 2 streams concurrently, buffer 3 items
  I.chunk(50), // in batches of 50
  I.map(myBatchTransform, 4), // Process 4 batches concurrently
  I.concat(), // flatten batches back into stream
  I.map(myItemTransform), // process items in stream one by one
  I.filter(Boolean), // remove nulls
  I.chunk(20), // 20 results per chunk
  I.take(10), // dont go over 10 batches
  I.map(processChunk, 2), // process 2 batches in parallel
  I.concat() // flatten stream again
);

// Looping over the pipeline starts computation
let i = 0;
for await (const result of pipeline) {
  if (++i > 25) {
    // Can stop production at will - after first 25 items
    // which will compute 3 batches in total:
    // 20 items from first batch, 5 items from second batch, and one full batch of 20 buffered by processChunk
    break;
  }
}

// Process items in batches for efficiency, then flatten results
const efficientPipeline = I.pipe(
  sourceItems,
  I.chunk(100), // Group into batches of 100 items
  I.map(async batch => {
    // Process each batch as a unit (e.g., bulk database operations)
    const results = await db.bulkInsert(batch);
    return results; // Returns array of results
  }, 3), // Process 3 batches concurrently
  I.concat(), // Flatten batch results back to individual items
  I.map(enrichItem) // Process individual results
);

for await (const item of efficientPipeline) {
  // Each item is processed individually after batch operations
  console.log(item);
}
```

### Features

- **map**: Transform items with controlled concurrency
- **filter**: Filter items with support for transformation
- **concat**: Process multiple async iterators concurrently
- **pipe**: Compose functions or data flows
- **chunk**: Group items in pages of N items
- **take**: Limit number of processed items

### Syntax

- Basic: `map(iterator, fn, concurrency)`
- Curried: `map(fn, concurrency)(iterator)`
- Pipe: `I.pipe(map(fn, concurrency), concat(concurency))`

## Concurrency Explained

### Why Concurrent Map?

The `map(fn, concurrency?: number)` function with concurrency control enables processing multiple items simultaneously without overwhelming system resources:

1. **IO Concurrency**: Avoids blocking on IO operations by allowing multiple operations to happen in parallel

   ```typescript
   // Race up to 3 network requests concurrently
   for await (const result of I.map(requestData, fetchFromApi, 3)) {
     console.log('One request done', result);
   }
   ```

2. **Backpressure Handling**: Automatically manages processing speed to match consumption speed

   ```typescript
   // Buffer up to 2 results, so when slow operation is done, it has another result to pull from
   for await (const result of I.map(items, processFn, 2)) {
     // Only one slow operation runs at once
     await slowOperation(result);
   }
   ```

3. **Composition**: Chain multiple concurrent operations together

   ```typescript
   // Create a pipeline of concurrent operations
   const pipeline = I.pipe(
     items,
     I.map(validateItem, 4), // Validate 4 items concurrently
     I.map(transformItem, 2) // Transform 2 items concurrently
   );
   ```

4. **Familiar semantics**: Map without concurrency acts as regular map over asynchronous iterator

   ```typescript:
     for await (const i of map([1,2,3], String)) {
       console.log(i) //1, 2, 3
     }
   ```

### Why Concurrent Concat?

The `concat(concurrency?: number, buffer?: number)` function processes multiple async iterators concurrently, intelligently managing how data flows between streams:

1. **Parallel Processing**: Streams are processed simultaneously, yielding values as soon as they're ready

   ```typescript
   // Mix results from two streams in FIFO order
   const streams = [fastStream, slowStream];
   const results = I.concat(streams, Infinity, Infinity);
   ```

2. **Control Over Input Sources**: Limit how many input streams are active simultaneously

   ```typescript
   // Only process 2 streams at a time, tapping the next stream when one completes
   const results = I.pipe([stream1, stream2, stream3, stream4], I.concat(2, Infinity));
   ```

3. **Buffer Management**: Control how many receieved values are buffered for next concurrent steps to consume

   ```typescript
   // Tap into 3 streams, keep 2 prepared items for final step
   const pipeline = I.pipe(
     [stream1, stream2, stream3], // Allow all streams to be active, but only buffer up to 2 values total
     I.concat(Infinity, 2), // Keep 2 values in output buffer at all times
     I.map(processItem) // once processItem is finished, it can immediately pull value from previous step's buffer
   );
   ```

4. **Stream Multiplexing**: Combine multiple streams and process them concurrently

   ```typescript
   // Process values from multiple streams with controlled concurrency
   const results = I.pipe(
     [stream1, stream2, stream3],
     I.concat(2, 4), // Tap into 2 streams at once, buffer 4 values
     I.map(processValue, 4) // Process 4 values concurrently
   );
   ```

5. **Familiar semantics**: Concat without concurrency under 2 acts as concat() over async stream, flattening incoming iterables

   ```typescript:
     for await (const i of concat([1,2], [3,4], 1, 1)) {
       console.log(i) //1, 2, 3, 4
     }
   ```

### Advanced Concurrency Patterns

These utilities enable sophisticated concurrency patterns for maximizing throughput in async processing pipelines:

1. **Saturating Slowest Steps**: Buffering keeps slower pipeline stages continuously fed with data

   ```typescript
   // Ensure the slow database query step always has inputs ready
   const pipeline = I.pipe(
     dataSource,
     I.map(parseData, 10), // Fast operation, high concurrency
     I.map(validateData, 8), // Medium operation, medium concurrency
     I.map(databaseQuery, 3) // Slow operation, lower concurrency but always fed
   );
   ```

   By having higher concurrency in earlier steps, the slowest step (database queries) will always have items waiting, eliminating idle time.

2. **Controlled Resource Usage**: Limit concurrency for resource-intensive operations

   ```typescript
   // Control database connection pool usage
   const results = I.map(
     userIds,
     async id => await pool.query('SELECT * FROM users WHERE id = ?', [id]),
     5 // Limit to 5 concurrent database queries
   );
   ```

3. **Multiplex Queue with Producer/Consumer Pools**: Use `concat()` to create sophisticated work distribution systems

   ```typescript
   // Create multiple producer and consumer streams
   const results = I.pipe(
     [
       I.map(produceFromSource1, 3)(source1),
       I.map(produceFromSource2, 2)(source2),
       I.map(produceFromSource3, 4)(source3),
     ],
     I.concat(2, 10), // 2 active sources, buffer of 10
     I.map(processWork, 8) // 8 concurrent workers consuming from the queue
   );
   ```

   This pattern creates a flexible system where work from multiple sources is intelligently buffered and fed to a pool of workers.

4. **Batching & Unbatching for Efficiency**: Create batch processing workflows with optimal throughput

   ```typescript
   // Process items in batches for efficiency, then flatten results
   const efficientPipeline = I.pipe(
     sourceItems,
     I.chunk(100), // Group into batches of 100 items
     I.map(async batch => {
       // Process each batch as a unit (e.g., bulk database operations)
       const results = await db.bulkInsert(batch);
       return results; // Returns array of results
     }, 3), // Process 3 batches concurrently
     I.concat(), // Flatten batch results back to individual items
     I.map(enrichItem) // Process individual results
   );

   for await (const item of efficientPipeline) {
     // Each item is processed individually after batch operations
     console.log(item);
   }
   ```

## API Reference

### map(fn, concurrency)

Creates a function that maps values from an iterable with specified concurrency.

- **fn**: Function to apply to each item in the iterable
- **concurrency**: Maximum number of concurrent operations (default: 1)
- **Returns**: A function that takes an iterable and returns an async generator

### filter(fn)

Filters elements based on a predicate. If the predicate returns a non-boolean/non-null value, that value is yielded instead.

- **fn**: Predicate function to test each item
- **Returns**: A function that takes an iterable and returns an async generator

### concat(maxConcurrentInputs, bufferSize)

Processes multiple async iterables concurrently, yielding values as they become available.

- **maxConcurrentInputs**: Maximum number of concurrent iterators to process (default: Infinity)
- **bufferSize**: Maximum number of values to buffer (default: Infinity)
- **Returns**: A function that takes an iterable of iterators and returns an async generator

### pipe(source, ...fns)

Composes multiple iterator transformations into a single processing pipeline.

- **source**: Source iterable
- **fns**: Functions to apply in sequence
- **Returns**: An async generator with all transformations applied

### take(n)

Takes a specified number of elements from an iterable.

- **n**: Number of elements to take
- **Returns**: A function that takes an iterable and returns an async generator

### chunk(size)

Groups elements from an iterable into arrays of specified size.

- **size**: Number of elements to include in each chunk
- **Returns**: A function that takes an iterable and returns an async generator yielding arrays of size `size`

## Todo

- Eager/lazy control for `concat()`
- `I.partition` to fork pipes

## License

MIT

## Acknowledgements

This library was inspired by [rotery](https://github.com/somnicattus/rotery) library, inspired by [ramda](https://github.com/ramda/ramda)

```

```
