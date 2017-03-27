//tslint:disable
import * as Mali from 'mali';
import * as hl from 'highland';
import * as opentracing from 'opentracing';
import * as sinon from 'sinon';

import {
  HawklyError,
  TracedRequestStream,
  createClient,
  hawklyMaliMiddleware,
} from './index';

import { TracedDuplexStream } from './client';
import { test } from 'ava';

const STREAM_DATA: any[] = [
  { message: '1 foo' },
  { message: '2 bar' },
  { message: '3 asd' },
  { message: '4 qwe' },
  { message: '5 rty' },
  { message: '6 zxc' },
];

// Allow for delay
function sleep(ms: number = 0): Promise<any> {
  return new Promise(r => setTimeout(r, ms));
}
// Helper function to generate a random integer
function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
let hostSeed: number = getRandomInt(1000, 9999);
const hosts: string[] = [];
function getHost(): string {
  const host: string = `0.0.0.0:4${hostSeed}`;
  hostSeed = hostSeed + 1;
  hosts.push(host);
  return host;
};


async function sayHello(ctx) {
  ctx.span.log({ event: 'processing' });
  const span: any = ctx.tracer.startSpan('sayHelloWork', { childOf: ctx.span });
  span.log({ event: 'creating response' });
  await sleep(4);
  ctx.res = { message: 'Hello ' + ctx.req.name };
  span.log({ event: 'created response' });
  span.finish();
}


test('unary request should work', async (t: any): Promise<void> => {
  await t.notThrows(async () => {
    const clientRecordCallback: any = sinon.spy();
    const serverRecordCallback: any = sinon.spy();
    const PROTO_PATH: string = __dirname + '/../proto/helloworld.proto';

    const grpcHost: string = getHost();
    const app: Mali = new Mali(PROTO_PATH);

    const hawklyTracerOptions: any = {
      accessToken: 'test',
      componentName: 'testServerComponent',
      recordCallback: serverRecordCallback,
    };

    // Add the hawkly middleware for tracing server calls
    app.use(hawklyMaliMiddleware(hawklyTracerOptions));
    // add our server handler for the sayHello call
    app.use({ sayHello });
    app.start(grpcHost);

    // Create the client
    const { tracer, client } = createClient({
      // hawkly
      accessToken: 'test',
      componentName: 'testComponent',
      recordCallback: clientRecordCallback,
      // grpc
      host: grpcHost,
      proto: PROTO_PATH,
      name: 'Greeter',
    });
    // Create a span to encapsulate our work
    const span: any = tracer.startSpan('/client/sayHellos');
    // create the gRPC request and wait for it to resolve
    const result: any = await client.sayHello({
      arg: { name: grpcHost },
      // pass in our span
      span,
    });

    span.finish();
    t.is(result.message, `Hello ${grpcHost}`);


    t.is(serverRecordCallback.callCount, 2);
    t.is(clientRecordCallback.callCount, 2);

    const clientSpans: any[] = clientRecordCallback.args;
    const serverSpans: any[] = serverRecordCallback.args;

    // First for convenice, well squish the span reports into the one array, and we'll extract them from the arg
    // I hate magic in code, and this looks like it could be magical if you're not up to speed with
    // the joys of ES6/7 and spread rest operators.
    //
    // So I'll explain.
    // We have two arrays of spans `clientSpans` and `serverSpans`, but they're not formatted right for us.
    // they're an array of arguments passed to recordCallback, as such we need only the first arg - the span reports
    // So what where doing here, working inside out, is mapping over the whole array, and creating a new
    // array containing only the first element of the array args. Array.map() always returns a new array,
    // which is perfect, for the next step.
    // With our new array we use the spread operator to spread out the array into a new array called spanReports
    // then we repeat this for serverSpans
    const spanReports: any[] = [
      ...clientSpans.map((args) => args[0]),
      ...serverSpans.map((args) => args[0]),
    ];

    const rootSpanReport: any = spanReports.find(
      (spanReport) => spanReport.referenceType === 'root',
    );
    // Check the root span from the clientSpans is really root
    t.is(rootSpanReport.referenceType, 'root');
    // Now we have the root spans, we should be able to chain every span together.
    // We expect 4 spans in total.
    t.true(spanReports.length === 4);
    const spanTwoReport: any = spanReports.find(
      (spanReport) => spanReport.parentId === rootSpanReport.spanId,
    );
    t.true(spanTwoReport.parentId === rootSpanReport.spanId);
    t.true(spanTwoReport.traceId === rootSpanReport.traceId);
    t.is(spanTwoReport.referenceType, 'childOf');

    const spanThreeReport: any = spanReports.find(
      (spanReport) => spanReport.parentId === spanTwoReport.spanId,
    );
    t.true(spanThreeReport.parentId === spanTwoReport.spanId);
    t.true(spanThreeReport.traceId === rootSpanReport.traceId);
    t.is(spanThreeReport.referenceType, 'childOf');

    const spanFourReport: any = spanReports.find(
      (spanReport) => spanReport.parentId === spanThreeReport.spanId,
    );
    t.true(spanFourReport.parentId === spanThreeReport.spanId);
    t.true(spanFourReport.traceId === rootSpanReport.traceId);
    t.is(spanFourReport.referenceType, 'childOf');
    // And close
    await app.close();
  });
});


test('unary request should return error in server handler back to client', async (t: any): Promise<void> => {
  t.plan(5);
  const PROTO_PATH: string = __dirname + '/../proto/helloworld.proto';

  const grpcHost: string = getHost();
  const app: Mali = new Mali(PROTO_PATH);
  const errMessage: string = 'test error';
  const errEventName: string = 'testError';
  const errPayload: any = { foo: 'bar' };

  const hawklyTracerOptions: any = {
    accessToken: 'test',
    componentName: 'testServerComponent',
    // recordCallback: serverRecordCallback,
    recordCallback: () => { }
  };

  // Add the hawkly middleware for tracing server calls
  app.use(hawklyMaliMiddleware(hawklyTracerOptions));
  // add our server handler for the sayHello call
  app.use({
    sayHello: () => {
      throw new HawklyError(errMessage, errEventName, errPayload);
    }
  });
  app.start(grpcHost);

  const error: Error | HawklyError = await t.throws(new Promise(
    async (resolve: Function, reject: Function) => {
      // Create the client
      const { tracer, client } = createClient({
        // hawkly
        accessToken: 'test',
        componentName: 'testComponent',
        recordCallback: () => { },
        // grpc
        host: grpcHost,
        proto: PROTO_PATH,
        name: 'Greeter',
      });

      app.silent = true;
      // Create a span to encapsulate our work
      const span: any = tracer.startSpan('/client/sayHello');
      // create the gRPC request and wait for it to resolve
      try {
        const result: any = await client.sayHello({
          arg: { name: grpcHost },
          // pass in our span
          span,
        });
        console.warn('result', result)
        span.finish();
        resolve(result);
      } catch (error) {
        span.finish();
        reject(error);
      }
    }));
  if (error) {
    t.true(error instanceof HawklyError);
    if (error instanceof HawklyError) {
      t.is(error.message, errMessage);
      t.is(error.eventName, errEventName);
      t.deepEqual(error.payload, errPayload);
    }
  }
  // And close
  await app.close();
});


// tslint:disable-next-line:max-func-body-length
test('request streaming should work', async (t: any) => {
  // tslint:disable-next-line:max-func-body-length
  await t.notThrows(async () => {
    const clientRecordCallback: any = sinon.spy();
    const serverRecordCallback: any = sinon.spy();
    const PROTO_PATH: string = __dirname + '/../proto/requestStream.proto';

    const grpcHost: string = getHost();
    const app: Mali = new Mali(PROTO_PATH);

    const hawklyTracerOptions: any = {
      accessToken: 'test',
      componentName: 'testRequestStreamServerComponent',
      recordCallback: serverRecordCallback,
    };

    // Add the hawkly middleware for tracing server calls
    app.use(hawklyMaliMiddleware(hawklyTracerOptions));
    // add our server handler for the sayHello call
    app.use({
      requestStream: async (ctx) => {
        return new Promise((resolve, reject) => {
          ctx.span.log({ event: 'processing' });
          const span: any = ctx.tracer.startSpan('processRequestStreamTest', { childOf: ctx.span });
          span.log({ event: 'creating response' });
          hl(ctx.req)
            .map(chunk => {
              return chunk.message.toUpperCase();
            })
            .collect()
            .toCallback((err, data) => {
              if (err) {
                return reject(err);
              }
              ctx.res = {
                message: data.join(':'),
              };
              resolve();
              span.log({ event: 'created response' });
              span.finish();
            });
        });

      },
    });
    app.start(grpcHost);

    // Create the client
    const { tracer, client } = createClient({
      // hawkly
      accessToken: 'test',
      componentName: 'testRequestStreamComponent',
      recordCallback: clientRecordCallback,
      // grpc
      host: grpcHost,
      proto: PROTO_PATH,
      name: 'RequestStreamTest',
    },
    );
    // Create a span to encapsulate our work
    const span: any = tracer.startSpan('/client/requestStreamTest');
    // create the gRPC request and wait for it to resolve
    const { call, result }: TracedRequestStream = client.requestStream({
      // pass in our span
      span,
    });
    // Write our array of STREAM_DATA to the call
    await [...STREAM_DATA].forEach(async (chunk: string) => {
      await call.write(chunk);
    });
    // End the call
    call.end();

    const streamResult = await result;

    span.finish();
    t.is(
      streamResult.message,
      [...STREAM_DATA].map((value) => value.message.toUpperCase()).join(' '),
    );

    t.is(serverRecordCallback.callCount, 2);
    t.is(clientRecordCallback.callCount, 2);

    const clientSpans: any[] = clientRecordCallback.args;
    const serverSpans: any[] = serverRecordCallback.args;

    const spanReports: any[] = [
      ...clientSpans.map((args) => args[0]),
      ...serverSpans.map((args) => args[0]),
    ];
    const rootSpanReport: any = spanReports.find(
      (spanReport) => spanReport.referenceType === 'root',
    );

    // Check the root span from the clientSpans is really root
    t.is(rootSpanReport.referenceType, 'root');

    t.true(spanReports.length === 4);
    const spanTwoReport: any = spanReports.find(
      (spanReport) => spanReport.parentId === rootSpanReport.spanId,
    );
    t.true(spanTwoReport.parentId === rootSpanReport.spanId);
    t.true(spanTwoReport.traceId === rootSpanReport.traceId);
    t.is(spanTwoReport.referenceType, 'childOf');

    const spanThreeReport: any = spanReports.find(
      (spanReport) => spanReport.parentId === spanTwoReport.spanId,
    );
    t.true(spanThreeReport.parentId === spanTwoReport.spanId);
    t.true(spanThreeReport.traceId === rootSpanReport.traceId);
    t.is(spanThreeReport.referenceType, 'childOf');

    const spanFourReport: any = spanReports.find(
      (spanReport) => spanReport.parentId === spanThreeReport.spanId,
    );
    t.true(spanFourReport.parentId === spanThreeReport.spanId);
    t.true(spanFourReport.traceId === rootSpanReport.traceId);
    t.is(spanFourReport.referenceType, 'childOf');

    // And close
    await app.close();
  });
});

// TODO also pass an arg
test('response streaming should work', async (t: any) => {
  // tslint:disable-next-line:max-func-body-length
  await t.notThrows(async () => {
    const clientRecordCallback: any = sinon.spy();
    const serverRecordCallback: any = sinon.spy();
    const PROTO_PATH: string = __dirname + '/../proto/responseStream.proto';

    const grpcHost: string = getHost();
    const app: Mali = new Mali(PROTO_PATH);

    const hawklyTracerOptions: any = {
      accessToken: 'test',
      componentName: 'testResponseStreamServerComponent',
      recordCallback: serverRecordCallback,
    };

    // Add the hawkly middleware for tracing server calls
    app.use(hawklyMaliMiddleware(hawklyTracerOptions));
    // add our server handler for the sayHello call
    app.use({
      responseStream: async (ctx) => {
        ctx.span.log({ event: 'processing' });
        const span: any = ctx.tracer.startSpan('procesResponseStreamTest', { childOf: ctx.span });
        span.log({ event: 'creating response' });
        ctx.res = hl([...STREAM_DATA])
          .map(chunk => chunk.message.toUpperCase());
        span.log({ event: 'created response' });
        span.finish();
      },
    });
    app.start(grpcHost);

    // Create the client
    const { tracer, client } = createClient({
      // hawkly
      accessToken: 'test',
      componentName: 'testResponseStreamComponent',
      recordCallback: clientRecordCallback,
      // grpc
      host: grpcHost,
      proto: PROTO_PATH,
      name: 'ResponseStreamTest',
    },
    );
    // Create a span to encapsulate our work
    const span: any = tracer.startSpan('/client/responseStreamTest');
    // create the gRPC request and wait for it to resolve
    const responseStream = client.responseStream({
      // pass in our span
      span,
    });
    const responseData: any[] = [];
    responseStream.on('data', data => {
      return responseData.push(data.message);
    });

    await new Promise((resolve: Function) => {
      return responseStream.on('end', () => {
        resolve();
      });
    });

    span.finish();
    t.is(
      responseData.join(' '),
      [...STREAM_DATA].map((value) => value.message.toUpperCase()).join(' '),
    );

    t.is(serverRecordCallback.callCount, 2);
    t.is(clientRecordCallback.callCount, 2);

    const clientSpans: any[] = clientRecordCallback.args;
    const serverSpans: any[] = serverRecordCallback.args;

    const spanReports: any[] = [
      ...clientSpans.map((args) => args[0]),
      ...serverSpans.map((args) => args[0]),
    ];

    const rootSpanReport: any = spanReports.find(
      (spanReport) => spanReport.referenceType === 'root',
    );

    // Check the root span from the clientSpans is really root
    t.is(rootSpanReport.referenceType, 'root');

    t.true(spanReports.length === 4);
    const spanTwoReport: any = spanReports.find(
      (spanReport) => spanReport.parentId === rootSpanReport.spanId,
    );
    t.true(spanTwoReport.parentId === rootSpanReport.spanId);
    t.true(spanTwoReport.traceId === rootSpanReport.traceId);
    t.is(spanTwoReport.referenceType, 'childOf');

    const spanThreeReport: any = spanReports.find(
      (spanReport) => spanReport.parentId === spanTwoReport.spanId,
    );
    t.true(spanThreeReport.parentId === spanTwoReport.spanId);
    t.true(spanThreeReport.traceId === rootSpanReport.traceId);
    t.is(spanThreeReport.referenceType, 'childOf');

    const spanFourReport: any = spanReports.find(
      (spanReport) => spanReport.parentId === spanThreeReport.spanId,
    );
    t.true(spanFourReport.parentId === spanThreeReport.spanId);
    t.true(spanFourReport.traceId === rootSpanReport.traceId);
    t.is(spanFourReport.referenceType, 'childOf');

    // And close
    await app.close();
  });
});

// tslint:disable-next-line:max-func-body-length
test('duplex streaming should work', async (t: any) => {
  t.plan(8);
  // tslint:disable-next-line:max-func-body-length
  const clientRecordCallback: any = sinon.spy();
  const serverRecordCallback: any = sinon.spy();
  const PROTO_PATH: string = __dirname + '/../proto/duplexStream.proto';
  const grpcHost: string = getHost();

  const app: Mali = new Mali(PROTO_PATH);

  const hawklyTracerOptions: any = {
    accessToken: 'test',
    componentName: 'testDuplexStreamServerComponent',
    recordCallback: serverRecordCallback,
  };

  // Add the hawkly middleware for tracing server calls
  app.use(hawklyMaliMiddleware(hawklyTracerOptions));
  // add our server handler for the sayHello call
  app.use({
    duplexStream: async (ctx) => {
      // When we receive data, send it back in upperCase
      ctx.req.on('data', (data) => {
        ctx.req.pause();
        const result = {
          message: data.message.toUpperCase(),
        };
        ctx.res.write(result, 'utf', () => {
          ctx.req.resume();
        });
      });

      // On end, finish the span, and this response
      ctx.req.on('end', () => {
        ctx.span.finish();
        ctx.res.end();
      });
    },
  });
  app.start(grpcHost);

  // Create the client
  const { tracer, client } = createClient({
    // hawkly
    accessToken: 'test',
    componentName: 'testDuplexStreamComponent',
    recordCallback: clientRecordCallback,
    // grpc
    host: grpcHost,
    proto: PROTO_PATH,
    name: 'DuplexStreamTest',
  },
  );
  // Create a span to encapsulate our work
  const span: any = tracer.startSpan('/client/duplexStreamTest');
  const { duplexStream, requestSpan }: TracedDuplexStream = client.duplexStream({
    span,
    returnSpan: true,
  });
  const responseData: any[] = [];
  duplexStream.on('data', data => {
    responseData.push(data.message);
  });
  duplexStream.on('end', () => {
    requestSpan.finish();
  });
  await Promise.all(
    [...STREAM_DATA].map((chunk: string) => {
      return new Promise((chunkResolve) => {
        duplexStream.write(chunk, 'utf8', chunkResolve(true));
      });
    }),
  ).then(async (results) => {
    // End the stream, then wait for a second to allow it to close
    duplexStream.end();
    span.finish();
    await sleep(1000);
    return results;
  }).then(() => {
    // Wait for a moment

    t.is(
      responseData.join(' '),
      [...STREAM_DATA].map((value) => value.message.toUpperCase()).join(' '),
    );
    t.is(serverRecordCallback.callCount, 1);
    t.is(clientRecordCallback.callCount, 2);
    const clientSpans: any[] = clientRecordCallback.args;
    const serverSpans: any[] = serverRecordCallback.args;

    const spanReports: any[] = [
      ...clientSpans.map((args) => args[0]),
      ...serverSpans.map((args) => args[0]),
    ];
    const rootSpanReport: any = spanReports.find(
      (spanReport) => spanReport.referenceType === 'root',
    );
    // Check the root span from the clientSpans is really root
    t.is(rootSpanReport.referenceType, 'root');

    t.true(spanReports.length === 3);
    const spanTwoReport: any = spanReports.find(
      (spanReport: any): boolean => {
        if (spanReport.parentId === rootSpanReport.spanId
          && spanReport.spanId !== rootSpanReport.spanId) {
          return true;
        }
        return false;
      },
    );
    t.true(spanTwoReport.parentId === rootSpanReport.spanId);
    t.true(spanTwoReport.traceId === rootSpanReport.traceId);
    t.is(spanTwoReport.referenceType, 'childOf');
  }).then(async () => {
    // And close
    await app.close();
  });
});

test('should be able to pass in another opentracing compatible Tracer()', async (t: any) => {
  await t.notThrows(async () => {
    const PROTO_PATH: string = __dirname + '/../proto/helloworld.proto';
    const grpcHost: string = getHost();

    const app: Mali = new Mali(PROTO_PATH);

    const hawklyTracerOptions: any = {
      accessToken: 'test',
      componentName: 'testServerComponent',
      // Add the default no-op Tracer
      tracer: new opentracing.Tracer(),
    };

    app.use(hawklyMaliMiddleware(hawklyTracerOptions));
    app.use({ sayHello });
    app.start(grpcHost);

    const { tracer, client } = createClient({
      // hawkly
      accessToken: 'test',
      componentName: 'testComponent',
      // Add the default no-op Tracer
      tracer: new opentracing.Tracer(),
      // grpc
      host: grpcHost,
      proto: PROTO_PATH,
      name: 'Greeter',
    },
    );

    const span: any = tracer.startSpan('/client/sayHellos');
    const result: any = await client.sayHello({
      arg: { name: grpcHost },
      span,
    });
    span.finish();
    t.is(result.message, `Hello ${grpcHost}`);

    // And close
    await app.close();
  });
});
