import * as createError from 'create-grpc-error';

import { Span, Tracer } from 'hawkly';

import { HawklyError } from './index';

function hawklyMaliMiddleware(options: any): any {
  let tracer: Tracer;
  if (typeof options.tracer === 'object') {
    tracer = options.tracer;
  } else {
    tracer = new Tracer(options);
  }

  // tslint:disable-next-line:no-function-expression only-arrow-functions
  return async function hawklyMiddleware(ctx: any, next: any): Promise<void> {
    // Extract the span context from the metadata
    let span: Span;
    try {
      const context: any = tracer.extract('text_map', ctx.metadata);
      span = tracer.startSpan(ctx.name, { childOf: context });
    } catch (err) {
      span = tracer.startSpan(ctx.name);
    }
    // Create a new span for this response from the extracted context

    span.setTag('grpc-call-type', ctx.type);

    // Add the newly created spanContext to the metadata so it's sent on
    // the next request out
    ctx.metadata = {
      ...ctx.metadata,
      ...span.context(),
    };

    // Add the tracer to the context for use
    ctx.tracer = tracer;
    // Add the span to the context for use
    ctx.span = span;
    try {
      await next();
    } catch (error) {
      if (error instanceof HawklyError) {
        ctx.span.log({
          event: error.eventName,
          payload: error.payload,
        });
        throw createError('HawklyError', {
          type: 'HawklyError',
          message: error.message,
          event: error.eventName,
          payload: error.getPayloadJSON(),
        });
      }
      ctx.span.finish();

      throw createError(error);
    }
    if (ctx.type !== 'duplex') {
      ctx.span.finish();
    }
  };
}

function hawklyKoaMiddleware(options: any): any {
  let tracer: Tracer;
  if (typeof options.tracer === 'object') {
    tracer = options.tracer;
  } else {
    tracer = new Tracer(options);
  }

  // tslint:disable-next-line:no-function-expression only-arrow-functions
  return async function hawklyMiddleware(ctx: any, next: any): Promise<void> {
    // if there is a span on the request then join
    if (false) { // TODO: ALL OF THIS
      // this.span = this.harmonia.tracer.join(
      //     `${this.service}.${message.action}`,
      //     lastReceivedMessage,
      // );

    } else { // otherwise create a new span
      this.span = this.harmonia.tracer.startSpan({
        operationName: `${this.service}.${ctx.request.method}`,
      });
    }

    // Add a bunch of useful tags to our span
    this.span.addTags({
      source: this.service,
      method: ctx.request.method,
      url: ctx.request.url,
      origin: ctx.request.origin,
      type: ctx.request.type,
      https: ctx.request.secure,
      ip: ctx.request.ip,
    });

    // Add the span to the Context object
    ctx.span = this.span;

    // Run all the other middlewares
    try {
      await next();
    } catch (err) {
      this.span.tag('error', true);
      this.span.log({
        event: 'error',
        payload: {
          error: err.message,
          status: err.status,
          trace: err.trace,
        },
      });
      // will only respond with JSON
      ctx.status = err.statusCode || err.status || 500;
      ctx.body = {
        message: err.message,
      };
    }
    // Finish our span
    this.span.finish();
  };
}

export {
  hawklyMaliMiddleware,
  hawklyKoaMiddleware,
}
