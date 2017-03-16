import * as opentracing from 'opentracing';
import * as sinon from 'sinon';

import { Tracer } from './Tracer';
import { test } from 'ava';

// This file contains tests for the public interface

test('Check Tracer options are set correctly', async (t: any) => {
  const accessToken: string = 'testAccessToken';
  const componentName: string = 'testComponentname';
  const recordCallback: any = sinon.spy();

  const tracer: any = new Tracer({
    accessToken,
    componentName,
    recordCallback,
  });

  t.is(tracer.accessToken, accessToken, 'accessToken does not match');
  t.is(tracer.componentName, componentName, 'componentName does not match');
  t.is(tracer.recordCallback, recordCallback, 'recordCallback does not match');

  // Call the recordCallback
  tracer.recordCallback();
  t.true(recordCallback.called);
});

test('Check Tracer throws when constructor options are not set correctly', async (t: any) => {
  // Check accessToken errors
  const accessTokenUndefinedError: any = t.throws(() => {
    const tracer: Tracer = new Tracer({
      componentName: 'help',
    });
    tracer.clear();
  });
  t.is(accessTokenUndefinedError.message, 'You need to set your accessToken for the hawkly tracer');

  const accessTokenNonStringError: any = t.throws(() => {
    const tracer: Tracer = new Tracer({
      accessToken: 234, // a non string should throw
      componentName: 'im',
    });
    tracer.clear();
  });
  t.is(accessTokenNonStringError.message, 'The accessToken must be a string');

  // Check componentName errors
  const componentNameUndefinedError: any = t.throws(() => {
    const tracer: Tracer = new Tracer({
      accessToken: 'trapped',
    });
    tracer.clear();
  });
  t.is(componentNameUndefinedError.message, 'You need to set a componentName to identify where these traces are coming from');

  const componentNameNonStringError: any = t.throws(() => {
    const tracer: Tracer = new Tracer({
      accessToken: 'in',
      componentName: 23423, // a non string should throw
    });
    tracer.clear();
  });
  t.is(componentNameNonStringError.message, 'The componentName must be a string');


  // Check recordCallback errors
  const recordCallbackNonFunctionButDefinedError: any = t.throws(() => {
    const tracer: Tracer = new Tracer({
      accessToken: 'a',
      componentName: 'testing',
      recordCallback: 'factory',  // anything defined that is not a function should throw
    });
    tracer.clear();
  });
  t.is(recordCallbackNonFunctionButDefinedError.message, 'recordCallback must be a function');
});

// Havent been able to get this to work
// test('should log error if the context is not a Span or Context', async (t: any) => {
//   const tracer: Tracer = new Tracer({
//     accessToken: 'test',
//     componentName: 'test',
//     recordCallback: () => {
//       //
//     },
//   });

//   const span: any = tracer.startSpan('test2', { childOf: undefined });
//   span.finish();

//   // t.is(tracer.internalEvents
//   console.log(tracer.internalEvents);
//   // t.true(tracer.internalEvents.find((event: any) => {
//   //   return event.msg === 'Span reference has an invalid context'
//   //     && event.payload === 'parent';
//   // }));

// });

test('supports childOf with a Span object', async (t: any) => {
  const tracer: Tracer = new Tracer({
    accessToken: 'test',
    componentName: 'test',
    recordCallback: () => {
      //
    },
  });
  const parent: any = tracer.startSpan('test1');
  const span: any = tracer.startSpan('test2', { childOf: parent });
  span.finish();
  parent.finish();
  t.true(span.context().traceId === parent.context().traceId, 'traceId does not match');
  t.true(span.context().parentId === parent.context().spanId, 'parentId does not match');
  t.true(parent.context().referenceType === 'root');
  t.true(span.context().referenceType === 'childOf');
});

test('supports childOf with a SpanContext object', async (t: any) => {
  const tracer: Tracer = new Tracer({
    accessToken: 'test',
    componentName: 'test',
    recordCallback: () => {
      //
    },
  });
  const parent: any = tracer.startSpan('test1');
  const span: any = tracer.startSpan('test2', { childOf: parent.context() });

  span.finish();
  parent.finish();

  t.true(span.context().traceId === parent.context().traceId, 'traceId does not match');
  t.true(span.context().parentId === parent.context().spanId, 'parentId does not match');
  t.true(parent.context().referenceType === 'root');
  t.true(span.context().referenceType === 'childOf');
});

test('supports followsFrom with a Span object', async (t: any) => {
  const tracer: Tracer = new Tracer({
    accessToken: 'test',
    componentName: 'test',
    recordCallback: () => {
      //
    },
  });
  const parent: any = tracer.startSpan('test1');
  const span: any = tracer.startSpan('test2', { followsFrom: parent });
  span.finish();
  parent.finish();


  t.true(span.context().traceId === parent.context().traceId, 'traceId does not match');
  t.true(span.context().parentId === parent.context().spanId, 'parentId does not match');
  t.true(parent.context().referenceType === 'root');
  t.true(span.context().referenceType === 'followsFrom');
});

test('supports followsFrom with a SpanContext object', async (t: any) => {
  const tracer: Tracer = new Tracer({
    accessToken: 'test',
    componentName: 'test',
    recordCallback: () => {
      //
    },
  });
  const parent: any = tracer.startSpan('test1');
  const parentContext: any = parent.context();
  parent.finish();

  const span: any = tracer.startSpan('test2', { followsFrom: parentContext });
  span.finish();

  t.true(span.context().traceId === parent.context().traceId, 'traceId does not match');
  t.true(span.context().parentId === parent.context().spanId, 'parentId does not match');

  t.true(parent.context().referenceType === 'root');
  t.true(span.context().referenceType === 'followsFrom');
});

test('supports startTime', async (t: any) => {
  const tracer: Tracer = new Tracer({
    accessToken: 'test',
    componentName: 'test',
    recordCallback: () => {
      //
    },
  });
  const now: number = Date.now() - 5000;
  const span: any = tracer.startSpan('test2', { startTime: now });
  span.finish();

  t.is(span._startMs, now, 'start time does not match what was supplied');
});

test('should throw when startTime is not a number', async (t: any) => {
  const error: any = await t.throws(() => {

    const tracer: Tracer = new Tracer({
      accessToken: 'test',
      componentName: 'test',
      recordCallback: () => {
        //
      },
    });
    const span: any = tracer.startSpan('test2', { startTime: 'now' });
    span.finish();
  });
  t.is(error.message, 'startTime must be a timestamp of type number');
});

test('supports tags on creation', async (t: any) => {
  await t.notThrows(() => {
    const tracer: Tracer = new Tracer({
      accessToken: 'test',
      componentName: 'test',
      recordCallback: () => {
        //
      },
    });
    // Verify that we can add tags at startSpan time.
    const span: any = tracer.startSpan('test', {
      tags: {
        tag_a: 1,
        tag_b: 'b',
        tag_c: true,
      },
    });
    span.finish();
  });
});

test('should throw when tags is not an object', async (t: any) => {
  const error: any = await t.throws(() => {

    const tracer: Tracer = new Tracer({
      accessToken: 'test',
      componentName: 'test',
      recordCallback: () => {
        //
      },
    });
    const span: any = tracer.startSpan('test', {
      tags: 'tags',
    });
    span.finish();
  });
  t.is(error.message, 'tags must be an object');
});

test('should throw when tags is an Array', async (t: any) => {
  const error: any = await t.throws(() => {

    const tracer: Tracer = new Tracer({
      accessToken: 'test',
      componentName: 'test',
      recordCallback: () => {
        //
      },
    });
    const span: any = tracer.startSpan('test', {
      tags: [],
    });
    span.finish();
  });
  t.is(error.message, 'tags must be an object');
});


test('supports tag creation with span.setTag', async (t: any) => {
  await t.notThrows(() => {
    const tracer: Tracer = new Tracer({
      accessToken: 'test',
      componentName: 'test',
      recordCallback: () => {
        //
      },
    });
    // Verify that we can add tags at startSpan time.
    const span: any = tracer.startSpan('test');
    span.setTag('foo', 'bar');
    span.finish();

    t.is(span._tags.foo, 'bar');
  });
});

test('should handle a large number of spans gracefully', async (t: any) => {
  await t.notThrows(() => {
    const tracer: Tracer = new Tracer({
      accessToken: 'test',
      componentName: 'test',
      recordCallback: () => {
        //
      },
    });

    // Loop through a large number of span creations.
    // This syntax may loop weird, but we're avoiding i++ and a for loop
    [...Array(10000)].forEach(() => {
      const span: any = tracer.startSpan('microspan');
      span.finish();
    });
  });
});

test('should handle clearing spans', async (t: any) => {
  const tracer: Tracer = new Tracer({
    accessToken: 'test',
    componentName: 'test',
    recordCallback: () => {
      //
    },
  });

  [...Array(100)].forEach(() => {
    const span: any = tracer.startSpan('microspan');
    span.finish();
  });
  t.true(tracer._spans.length === 100);
  tracer.clear();
  t.true(tracer._spans.length === 0);

});

test('should handle passing in the opentracing module', async (t: any) => {
  const tracer: Tracer = new Tracer({
    accessToken: 'test',
    componentName: 'test',
    opentracingModule: opentracing,
    recordCallback: () => {
      //
    },
  });
  // Verify that we can add tags at startSpan time.
  const span: any = tracer.startSpan('test');
  span.finish();
  t.is(tracer.opentracing, opentracing);
});


test('should throw when the first arg of Span.log() is not an object', async (t: any) => {
  const error: any = await t.throws(() => {

    const tracer: Tracer = new Tracer({
      accessToken: 'test',
      componentName: 'test',
      recordCallback: () => {
        //
      },
    });
    const span: any = tracer.startSpan('test', {
      tags: [],
    });
    span.finish();
  });
  t.is(error.message, 'tags must be an object');
});

test('should be able to inject Context into a TextMap', async (t: any) => {
  const tracer: Tracer = new Tracer({
    accessToken: 'test',
    componentName: 'test',
    recordCallback: () => {
      //
    },
  });
  const carrier: any = {};
  const span: any = tracer.startSpan('test');
  span.finish();
  tracer.inject(span, 'text_map', carrier);

  t.is(carrier['ot-tracer-spanid'], span.context().spanId);
  t.is(carrier['ot-tracer-parentid'], span.context().parentId);
  t.is(carrier['ot-tracer-traceid'], span.context().traceId);
  t.is(carrier['ot-tracer-referencetype'], span.context().referenceType);
  t.is(carrier['ot-tracer-sampled'], span.context().sampled);
});

test('should be able to extract a Context from a TextMap', async (t: any) => {
  const tracer: Tracer = new Tracer({
    accessToken: 'test',
    componentName: 'test',
    recordCallback: () => {
      //
    },
  });
  const carrier: any = {};
  const span: any = tracer.startSpan('test');
  span.finish();
  tracer.inject(span, 'text_map', carrier);

  t.is(carrier['ot-tracer-spanid'], span.context().spanId);
  t.is(carrier['ot-tracer-parentid'], span.context().parentId);
  t.is(carrier['ot-tracer-traceid'], span.context().traceId);
  t.is(carrier['ot-tracer-referencetype'], span.context().referenceType);
  t.is(carrier['ot-tracer-sampled'], span.context().sampled);

  const extractedContext: any = tracer.extract('text_map', carrier);

  t.is(extractedContext.spanId, span.context().spanId);
  t.is(extractedContext.parentId, span.context().parentId);
  t.is(extractedContext.traceId, span.context().traceId);
  t.is(extractedContext.referenceType, span.context().referenceType);
  t.is(extractedContext.sampled, span.context().sampled);


});

test('should be able to inject Context into a TextMap', async (t: any) => {
  const tracer: Tracer = new Tracer({
    accessToken: 'test',
    componentName: 'test',
    recordCallback: () => {
      //
    },
  });
  const carrier: any = {};
  const span: any = tracer.startSpan('test');
  span.finish();
  tracer.inject(span, 'text_map', carrier);

  t.is(carrier['ot-tracer-spanid'], span.context().spanId);
  t.is(carrier['ot-tracer-parentid'], span.context().parentId);
  t.is(carrier['ot-tracer-traceid'], span.context().traceId);
  t.is(carrier['ot-tracer-referencetype'], span.context().referenceType);
  t.is(carrier['ot-tracer-sampled'], span.context().sampled);
});

test('should be able to join to a carrier', async (t: any) => {
  const tracer: Tracer = new Tracer({
    accessToken: 'test',
    componentName: 'test',
    recordCallback: () => {
      //
    },
  });
  const carrier: any = {};
  const span: any = tracer.startSpan('test');
  span.finish();
  tracer.inject(span, 'text_map', carrier);

  const childSpan: any = tracer.join('childSpan', carrier, 'text_map');
  childSpan.finish();

  t.is(childSpan.context().parentId, span.context().spanId);
  t.is(childSpan.context().traceId, span.context().traceId);
  t.is(childSpan.context().referenceType, 'childOf');
});
