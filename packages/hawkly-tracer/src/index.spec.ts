import * as sinon from 'sinon';

import { Tracer } from './index';
import { test } from 'ava';

// Helper function to generate a random integer
function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// This file contains tests for the public interface

test('Single Span', async (t: any) => {
  const recordCallback: any = sinon.spy();
  const operationName: string = 'test1';

  const tracer: any = new Tracer({
    accessToken: 'testAccessToken',
    componentName: 'indexSpec/singleSpan',
    recordCallback,
  });


  const x: number = getRandomInt(2, 50);
  const y: number = getRandomInt(2, 50);

  const span: any = tracer.startSpan(operationName);
  span.logEvent('receivedInput', { x, y });
  const result: number = x + y;
  span.logEvent('finishedCalculation');
  span.finish();

  t.true(result === x + y);
  t.true(recordCallback.calledOnce);

  // Check the report object is intact O_O
  t.true(recordCallback.args[0][0].operationName === operationName);
  t.true(typeof recordCallback.args[0][0].traceId === 'string', 'traceId is not a string');
  t.true(typeof recordCallback.args[0][0].spanId === 'string', 'spanId is not a string');
});

test('Span with single childOf', async (t: any) => {
  const recordCallback: any = sinon.spy();
  const operationName: string = 'test2';

  const tracer: any = new Tracer({
    accessToken: 'testAccessToken',
    componentName: 'indexSpec/SpanWithSingleChild',
    recordCallback,
  });


  const x: number = getRandomInt(2, 50);
  const y: number = getRandomInt(2, 50);
  const z: number = getRandomInt(2, 50);

  // create the first span
  const parentSpan: any = tracer.startSpan(operationName);
  parentSpan.logEvent('receivedInput', { x, y });

  const result: number = x + y;
  // Run our second operation in an async function
  async function childFunction(parentSpan: any, result: number): Promise<number> {
    const childSpan: any = tracer.startSpan('childOf2', { childOf: parentSpan });

    const _childResult: number = result * z;

    childSpan.logEvent('completed math');
    childSpan.finish();

    return _childResult;
  }
  const childResult: number = await childFunction(parentSpan, result);

  parentSpan.logEvent('finishedCalculation', { childResult });
  parentSpan.finish();

  // t.true(result === x + y);
  t.true(recordCallback.calledTwice);

});


test('Span with single followsFrom', async (t: any) => {
  const operationName: string = 'test3';
  const recordCallback: any = sinon.spy();

  const tracer: any = new Tracer({
    accessToken: 'testAccessToken',
    componentName: 'indexSpec/SpanWithSingleFollowsFrom',
    recordCallback,
  });

  // create the first span
  const parentSpan: any = tracer.startSpan(operationName);

  const childSpan: any = tracer.startSpan('followsFrom', { followsFrom: parentSpan });
  childSpan.logEvent('created the child span');
  parentSpan.finish();

  childSpan.finish();
  // t.true(result === x + y);
  t.true(recordCallback.calledTwice);
  t.is(parentSpan.context().referenceType, 'root');
  t.is(childSpan.context().referenceType, 'followsFrom');
  t.is(childSpan.context().parentId, parentSpan.context().spanId);
  t.is(childSpan.context().traceId, parentSpan.context().traceId);

});


test('Span with single followsFrom and childOf', async (t: any) => {
  const operationName: string = 'test3';
  const recordCallback: any = sinon.spy();

  const tracer: any = new Tracer({
    accessToken: 'testAccessToken',
    componentName: 'indexSpec/SpanWithSingleFollowsFrom',
    recordCallback,
  });

  // create the first span
  const grandParentSpan: any = tracer.startSpan(operationName);
  const parentSpan: any = tracer.startSpan(operationName, { childOf: grandParentSpan });
  const childSpan: any = tracer.startSpan('followsFrom', { followsFrom: parentSpan });
  parentSpan.finish();
  grandParentSpan.finish();
  childSpan.finish();

  t.true(recordCallback.calledThrice);
  t.is(grandParentSpan.context().referenceType, 'root');
  t.is(parentSpan.context().referenceType, 'childOf');
  t.is(parentSpan.context().parentId, grandParentSpan.context().spanId);
  t.is(childSpan.context().referenceType, 'followsFrom');
  t.is(childSpan.context().parentId, parentSpan.context().spanId);
  t.is(childSpan.context().traceId, parentSpan.context().traceId, grandParentSpan.context().traceId);

});
