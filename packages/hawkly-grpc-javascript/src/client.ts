import * as createMetadata from 'grpc-create-metadata';
import * as grpc from 'grpc';
import * as grpcInspect from 'grpc-inspect';

import { Span, Tracer } from 'hawkly';

import { HawklyError } from './index';

let tracer: Tracer | undefined;
// const lastSpan: Span | undefined;
function createClient(options: any): any {
  if (typeof options.tracer === 'object') {
    tracer = options.tracer;
  } else {
    tracer = new Tracer(options);
  }
  const clientFunction: any = client(options.host, options.proto, options.name, options.grpcOptions);
  return {
    client: clientFunction,
    tracer,
  };
}

function getLastChildSpan(): Span | undefined {
  return undefined;
}


// tslint:disable-next-line:max-func-body-length
function client(host: string, proto: string, name: string, options: any): any {
  let grpcClient: any;
  if (typeof proto === 'string') {
    const loaded: any = grpc.load(proto);
    const descriptor: any = grpcInspect(loaded);
    if (!descriptor) {
      throw new Error('Error parsing protocol buffer');
    }

    grpcClient = descriptor.client(name);
    if (!grpcClient) {
      throw new Error(`Service name ${name} not found in protocol buffer definition`);
    }
  } else if (typeof proto === 'object') {
    grpcClient = proto;
    options = name;
  }
  const clientProto: any = grpcClient.prototype;
  // Search the prototype of gRPC client, and find the request methods,
  // then promisify and trace them
  Object.keys(clientProto).forEach((key: any) => {
    const originalFunction: any = clientProto[key];
    // store a reference to the call name for use when creating the span
    const callName: string = key;

    // Here we check to see if the function we're working on on the prototype
    // matches the pattern we know exists for the 4 kinds of calls.
    if (typeof clientProto[key] === 'function') {
      if ( // type:unary
        !originalFunction.responseStream &&
        !originalFunction.requestStream
      ) {
        clientProto[key] = wrapUnaryRequest(originalFunction, callName);
      } else if ( // type:server stream
        originalFunction.responseStream &&
        !originalFunction.requestStream
      ) {
        clientProto[key] = wrapResponseStream(originalFunction, callName);
      } else if ( // type:client stream
        !originalFunction.responseStream &&
        originalFunction.requestStream
      ) {
        clientProto[key] = wrapRequestStream(originalFunction, callName);
      } else if ( // type:bidirectional stream
        originalFunction.responseStream &&
        originalFunction.requestStream
      ) {
        clientProto[key] = wrapDuplexStream(originalFunction, callName);
      }
    }
  });

  return new grpcClient(host, options || grpc.credentials.createInsecure());
}


export interface TracedUnaryRequest {
  request: Promise<any>;
  requestSpan: Span;
  span: Span;
}
/**
 * Wrap the unaryRequest function on the grpc client,
 * this adds tracing and Promise support.
 */
function wrapUnaryRequest(originalFunction: Function, callName: string): Function {
  // tslint:disable-next-line:no-function-expression only-arrow-functions
  return function unaryRequest(
    options: {
      arg: any,
      metadata: any,
      options: any,
      span: Span,
      returnSpan: boolean,
    },
  ): TracedUnaryRequest | Promise<any> {
    // only promisify-call functions in simple response / request scenario
    if (typeof tracer === 'object') {
      // Create the span
      let span: Span;
      if (options.span instanceof Span) {
        span = tracer.startSpan(callName, { childOf: options.span });
      } else {
        // create a new root span
        span = tracer.startSpan(callName);
      }
      const carrier: any = options.metadata || {};
      tracer.inject(span, 'text_map', carrier);
      const request: Promise<any> = new Promise((resolve: any, reject: any) => {
        const args: any[] = [
          options.arg,
          createMetadata(carrier),
          options.options,
          // Provide a callback for this promise to resolve
          (err: any, callback: any): void => {
            if (err) {
              const errMetadata: any = err.metadata.getMap();
              if (errMetadata.type === 'HawklyError') {
                try {
                  const errPayload: {} = JSON.parse(errMetadata.payload);
                  reject(
                    new HawklyError(
                      errMetadata.message,
                      errMetadata.event,
                      errPayload,
                    ),
                  );
                } catch (jsonErr) {
                  reject(
                    new HawklyError(
                      errMetadata.message,
                      errMetadata.event,
                    ),
                  );
                }
              }
              reject(err);

              span.setTag({ error: true });
              span.log({ event: 'Error in unaryRequest callback', payload: err });
            }
            resolve(callback);
            span.finish();
          },
        ];
        // tslint:disable-next-line:no-invalid-this
        originalFunction.apply(this, args);
      });
      // When requested return the span created for this request
      if (options.returnSpan) {
        return {
          request,
          // Also return the span as requestSpan so that the caller can
          // destructure this object if they already have a local span object
          requestSpan: span,
          span,
        };
      } else {
        // Otherwise just return the Promise
        return request;
      }
    } else {
      // If the tracer isn't working we hard fail
      throw new Error('Hawkly Tracer has not been initialised.');
    }
  };
}


export interface TracedRequestStream {
  result: Promise<any>;
  call: any;
  requestSpan: Span;
  span: Span;
}
function wrapRequestStream(originalFunction: Function, callName: string): Function {
  // tslint:disable-next-line:no-function-expression only-arrow-functions
  return function requestStream(options: {
    span: Span,
    metadata: {},
    options: {},
  }): TracedRequestStream {
    // only promisify-call functions in simple response / request scenario
    if (typeof tracer === 'object') {
      // Create the span
      let span: Span;
      if (options.span instanceof Span) {
        span = tracer.startSpan(callName, { childOf: options.span });
      } else {
        // create a new root span
        span = tracer.startSpan(callName);
      }
      // Create a metadata object
      const carrier: any = options.metadata || {};
      tracer.inject(span, 'text_map', carrier);
      const requestStream: any = {
        span,
        requestSpan: Span,
      };
      const result: Promise<any> = new Promise((resolve: any, reject: any) => {
        const args: any[] = [
          createMetadata(carrier),
          options.options,
          // Provide a callback for this promise to resolve
          (err: any, callback: any): void => {
            if (err) {
              const errMetadata: any = err.metadata.getMap();
              if (errMetadata.type === 'HawklyError') {
                try {
                  const errPayload: {} = JSON.parse(errMetadata.payload);
                  reject(
                    new HawklyError(
                      errMetadata.message,
                      errMetadata.event,
                      errPayload,
                    ),
                  );
                } catch (jsonErr) {
                  reject(
                    new HawklyError(
                      errMetadata.message,
                      errMetadata.event,
                    ),
                  );
                }
              }
              reject(err);
              span.setTag({ error: true });
              span.log({ event: 'Error in responseStream callback', payload: err });
            }
            resolve(callback);
            span.finish();
          },
        ];
        // tslint:disable-next-line:no-invalid-this
        requestStream.call = originalFunction.apply(this, args);
      });
      requestStream.result = result;
      return requestStream;
    }
    // If the tracer isn't working we hard fail
    throw new Error('Hawkly Tracer has not been initialised.');
  };
}
export interface TracedResponseStream {
  responseStream: any;
  requestSpan: Span;
  span: Span;
}
function wrapResponseStream(originalFunction: Function, callName: string): Function {
  // tslint:disable-next-line:no-function-expression only-arrow-functions
  return function responseStream(options: {
    arg: any,
    span: Span,
    metadata: {},
    options: {},
    returnSpan: boolean,
  }): TracedResponseStream | any {
    // only promisify-call functions in simple response / request scenario
    if (typeof tracer === 'object') {
      // Create the span
      let span: Span;
      if (options.span instanceof Span) {
        span = tracer.startSpan(callName, { childOf: options.span });
      } else {
        // create a new root span
        span = tracer.startSpan(callName);
      }
      // Create a metadata object
      const carrier: any = options.metadata || {};
      tracer.inject(span, 'text_map', carrier);
      const args: any[] = [
        options.arg,
        createMetadata(carrier),
        options.options,
      ];
      // tslint:disable-next-line:no-invalid-this
      const responseStream: any = originalFunction.apply(this, args);
      if (options.returnSpan) {
        return {
          responseStream,
          requestSpan: span,
          span,
        };
      } else {
        span.finish();
        return responseStream;
      }
    }
    // If the tracer isn't working we hard fail
    throw new Error('Hawkly Tracer has not been initialised.');
  };
}

export interface TracedDuplexStream {
  duplexStream: any;
  requestSpan: Span;
  span: Span;
}
function wrapDuplexStream(originalFunction: Function, callName: string): Function {
  // tslint:disable-next-line:no-function-expression only-arrow-functions
  return function duplexStream(options: {
    span: Span,
    metadata: {},
    options: {},
    returnSpan: boolean,

  }): TracedDuplexStream | any {
    // only promisify-call functions in simple response / request scenario
    if (typeof tracer === 'object') {
      // Create the span
      let span: Span;
      if (options.span instanceof Span) {
        span = tracer.startSpan(callName, { childOf: options.span });
      } else {
        // create a new root span
        span = tracer.startSpan(callName);
      }
      // Create a metadata object
      const carrier: any = options.metadata || {};
      tracer.inject(span, 'text_map', carrier);
      const args: any[] = [
        createMetadata(carrier),
        options.options,
      ];
      // tslint:disable-next-line:no-invalid-this
      const duplexStream: any = originalFunction.apply(this, args);
      if (options.returnSpan) {
        return {
          duplexStream,
          requestSpan: span,
          span,
        };
      } else {
        span.finish();
        return duplexStream;
      }
    }
    // If the tracer isn't working we hard fail
    throw new Error('Hawkly Tracer has not been initialised.');
  };
}

export {
  createClient,
  createMetadata,
  getLastChildSpan,
}
