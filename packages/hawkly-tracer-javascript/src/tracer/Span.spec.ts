import { Context } from './Context';
import { Span } from './Span';
import { Tracer } from './Tracer';
import { test } from 'ava';

test('can add logs', async (t: any) => {
  const tracer: Tracer = new Tracer({
    accessToken: 'test',
    componentName: 'test',
    recordCallback: () => {
      //
    },
  });
  let traceId: string;
  let parentId: string;
  let spanId: string;

  parentId = traceId = spanId = tracer.generateUUID();

  const span: Span = new Span(
    tracer,
    'testSpan',
    new Context(
      spanId,
      parentId,
      traceId,
      'root',
    ),
    {
      startTime: Date.now(),
      tags: {},
    },
  );

  const timestamp: number = Date.now();
  const log: any = {
    event: 'event name',
    payload: {
      foo: 'bar',
    },
  };

  span.log(log, timestamp);
  t.is(span._logs[0].timestamp, timestamp);
  t.is(span._logs[0].event, log.event);
  t.is(span._logs[0].payload, log.payload);
});

test('should throw if log does not have an event name', async (t: any) => {
  const error: any = await t.throws(() => {
    const tracer: Tracer = new Tracer({
      accessToken: 'test',
      componentName: 'test',
      recordCallback: () => {
        //
      },
    });
    let traceId: string;
    let parentId: string;
    let spanId: string;

    parentId = traceId = spanId = tracer.generateUUID();

    const span: Span = new Span(
      tracer,
      'testSpan',
      new Context(
        spanId,
        parentId,
        traceId,
        'root',
      ),
      {
        startTime: Date.now(),
        tags: {},
      },
    );
    span.log({});
  });
  t.is(error.message, 'Span.log() must contain an event name. For example Span.Log({event: \'eventName\')');

});

test('should handle a timestamp that is not a number', async (t: any) => {
  await t.notThrows(() => {
    const tracer: Tracer = new Tracer({
      accessToken: 'test',
      componentName: 'test',
      recordCallback: () => {
        //
      },
    });
    let traceId: string;
    let parentId: string;
    let spanId: string;

    parentId = traceId = spanId = tracer.generateUUID();

    const span: Span = new Span(
      tracer,
      'testSpan',
      new Context(
        spanId,
        parentId,
        traceId,
        'root',
      ),
      {
        startTime: Date.now(),
        tags: {},
      },
    );

    const log: any = {
      event: 'event name',
      payload: {
        foo: 'bar',
      },
    };

    span.log(log, 'timestamp');
    t.true(typeof span._logs[0].timestamp === 'number');
  });
});

test('should throw if first argument of logs is not an object', async (t: any) => {
  const error: any = await t.throws(() => {
    const tracer: Tracer = new Tracer({
      accessToken: 'test',
      componentName: 'test',
      recordCallback: () => {
        //
      },
    });
    let traceId: string;
    let parentId: string;
    let spanId: string;

    parentId = traceId = spanId = tracer.generateUUID();

    const span: Span = new Span(
      tracer,
      'testSpan',
      new Context(
        spanId,
        parentId,
        traceId,
        'root',
      ),
      {
        startTime: Date.now(),
        tags: {},
      },
    );

    span.log('log', Date.now());
  });
  t.is(error.message, 'Span.log() expects an object as its first argument');
});
