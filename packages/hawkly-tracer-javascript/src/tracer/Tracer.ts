import * as opentracing from 'opentracing';

import { Context } from './Context';
import { Span } from './Span';

const COLLECTOR_HOSTNAME: string = 'https://collector.hawkly.io';
const CARRIER_TRACER_STATE_PREFIX: string = 'ot-tracer-';
const CARRIER_BAGGAGE_PREFIX: string = 'ot-baggage-';
const CARRIER_FIELD_NAME_TRACE_ID: string = 'traceid';
const CARRIER_FIELD_NAME_SPAN_ID: string = 'spanid';
const CARRIER_FIELD_NAME_PARENT_ID: string = 'parentid';
const CARRIER_FIELD_NAME_REFERENCE_TYPE: string = 'referencetype';
const CARRIER_FIELD_NAME_SAMPLED: string = 'sampled';
const CARRIER_FIELD_COUNT: number = 5;

export class Tracer extends opentracing.Tracer {

  public startSpan: Function;

  public opentracing: any;
  public _spans: Span[];

  public internalEvents: any[] = [];

  // Optional function that is called instead on the normal record function.
  // Used to send spans to a collection service to forward in bulk.
  public recordCallback: any;

  // This is your unique public access token, get it from hawkly.io
  public accessToken: string;

  // The name of this component or service
  public componentName: string;

  public collectorHostname: string = COLLECTOR_HOSTNAME;

  public beginMs: number;

  public endMs: number;
  public inject: any;
  public extract: any;

  public _startSpan(name: any, fields: any): any {
    let parentContext: Context | undefined = undefined;
    let traceId: string;
    let parentId: string;
    let spanId: string;
    let referenceType: string | undefined = undefined;

    fields = fields || {};
    if (fields.followsFrom) {
      // Convert from a Span or a SpanContext into a Reference.
      const followsFrom: any = this.opentracing.followsFrom(fields.followsFrom);
      if (fields.references) {
        fields.references.push(followsFrom);
      } else {
        fields.references = [followsFrom];
      }
      delete (fields.followsFrom);
    }

    // If there are any references we need to process them
    if (fields.references) {
      // Loop through until we find them
      for (const i: number = 0; i < fields.references.length; i + 1) {
        const ref: any = fields.references[i];
        const refType: string = ref.type();
        if (refType === this.opentracing.REFERENCE_CHILD_OF ||
          refType === this.opentracing.REFERENCE_FOLLOWS_FROM) {
          referenceType = refType;
          const context: any = ref.referencedContext();
          if (!context) {
            this.recordInternalEvent('Span reference has an invalid context', context);
            continue;
          }
          parentContext = context;
          break;
        }
      }
    }
    // If there is a traceId from the parent span use that, or create a new one
    if (parentContext) {
      traceId = parentContext.traceId;
      parentId = parentContext.spanId;
      spanId = this.generateUUID();
    } else {
      // if this is the root span,  parentId, traceId, spanId are all the same
      parentId = traceId = spanId = this.generateUUID();
    }

    // check some of the optional fields are of the right type
    if (fields.startTime) {
      if (typeof fields.startTime !== 'number') {
        throw new Error('startTime must be a timestamp of type number');
      }
    }
    if (fields.tags) {
      if (typeof fields.tags !== 'object' || Array.isArray(fields.tags)) {
        throw new Error('tags must be an object');
      }
    }

    // create the span, and pass in it's Context
    const span: Span = new Span(
      this,
      name,
      new Context(
        spanId,
        parentId,
        traceId,
        referenceType,
      ),
      {
        startTime: fields.startTime ? fields.startTime : Date.now(),
        tags: fields.tags ? fields.tags : {},
      },
    );

    this._spans.push(span);

    return span;
  }

  public _inject(spanContext: Context, format: any, carrier: any): void {
    switch (format) {
      case this.opentracing.FORMAT_TEXT_MAP:
        this._injectToTextMap(spanContext, carrier);
        break;

      case this.opentracing.FORMAT_BINARY:
        this.recordInternalEvent(`Unsupported format: ${format}`);
        break;

      default:
        this.recordInternalEvent(`Unknown format: ${format}`);
        break;
    }
  }

  private _injectToTextMap(context: Context, carrier: any): any | undefined {
    if (!carrier) {
      this.recordInternalEvent('Unexpected null FORMAT_TEXT_MAP carrier in call to inject');
      return;
    }
    if (typeof carrier !== 'object') {
      this.recordInternalEvent(`Unexpected '${typeof carrier}' FORMAT_TEXT_MAP carrier in call to inject`);
      return;
    }

    carrier[`${CARRIER_TRACER_STATE_PREFIX}${CARRIER_FIELD_NAME_SPAN_ID}`] = context.spanId;
    carrier[`${CARRIER_TRACER_STATE_PREFIX}${CARRIER_FIELD_NAME_PARENT_ID}`] = context.parentId;
    carrier[`${CARRIER_TRACER_STATE_PREFIX}${CARRIER_FIELD_NAME_TRACE_ID}`] = context.traceId;
    carrier[`${CARRIER_TRACER_STATE_PREFIX}${CARRIER_FIELD_NAME_REFERENCE_TYPE}`] = context.referenceType;

    // Baggage currently not implemented
    // context.forEachBaggageItem((key: string, value: any) => {
    //   carrier[`${CARRIER_BAGGAGE_PREFIX}${key}`] = value;
    // });

    carrier[`${CARRIER_TRACER_STATE_PREFIX}${CARRIER_FIELD_NAME_SAMPLED}`] = context.sampled;

    return carrier;
  }

  public _extract(format: string, carrier: any): any | undefined {
    switch (format) {
      case this.opentracing.FORMAT_HTTP_HEADERS:
      case this.opentracing.FORMAT_TEXT_MAP:
        return this._extractTextMap(carrier);

      case this.opentracing.FORMAT_BINARY:
        this.recordInternalEvent(`Unsupported format: ${format}`);
        return undefined;

      default:
        this.recordInternalEvent(`Unsupported format: ${format}`);
        return undefined;
    }
  }

  /**
   * Create a new Context from a carrier JSON object
   */
  private _extractTextMap(carrier: any): any {
    // Begin with the empty SpanContextImp
    const fields: any = {
      baggage: [],
    };
    let count: number = 0;

    Object.keys(carrier).forEach((field: string) => {
      if (field === CARRIER_TRACER_STATE_PREFIX + CARRIER_FIELD_NAME_TRACE_ID) {
        fields.traceId = carrier[field];
        count += 1;
      } else if (field === CARRIER_TRACER_STATE_PREFIX + CARRIER_FIELD_NAME_SPAN_ID) {
        fields.spanId = carrier[field];
        count += 1;
      } else if (field === CARRIER_TRACER_STATE_PREFIX + CARRIER_FIELD_NAME_PARENT_ID) {
        fields.parentId = carrier[field];
        count += 1;
      } else if (field === CARRIER_TRACER_STATE_PREFIX + CARRIER_FIELD_NAME_REFERENCE_TYPE) {
        fields.referenceType = carrier[field];
        count += 1;
      } else if (field === CARRIER_TRACER_STATE_PREFIX + CARRIER_FIELD_NAME_SAMPLED) {
        if (carrier[field] !== 'true' &&
          carrier[field] !== 'false' &&
          carrier[field] !== true &&
          carrier[field] !== false) {
          throw new Error('Trace corrupted, sampled should be type ' +
            `Boolean, got ${carrier[field]}`);
        } else {
          fields.sampled = Boolean(carrier[field]);
        }
        count += 1;
      } else if (field.indexOf(CARRIER_BAGGAGE_PREFIX) === 0) {
        fields.baggage[field.slice(CARRIER_BAGGAGE_PREFIX.length)] =
          carrier[field];
      }
    });
    if (count !== CARRIER_FIELD_COUNT) {
      throw new Error('Trace corrupted, ' +
        'require traceId, spanId and sampled');
    }
    return new Context(fields.spanId, fields.parentId, fields.traceId);
  }

  constructor(options: any) {
    super();
    this._spans = [];

    // Check that we have an accessToken that is a string
    if (typeof options.accessToken === undefined
      || options.accessToken === undefined) {
      throw new Error('You need to set your accessToken for the hawkly tracer');
    } else if (typeof options.accessToken !== 'string') {
      throw new Error('The accessToken must be a string');
    } else {
      this.accessToken = options.accessToken;
    }

    // Check that we have a componentName that is a string
    if (typeof options.componentName === undefined
      || options.componentName === undefined) {
      throw new Error('You need to set a componentName to identify where these traces are coming from');
    } else if (typeof options.componentName !== 'string') {
      throw new Error('The componentName must be a string');
    } else {
      this.componentName = options.componentName;
    }

    // Check that the recordCallback is the correct type if one is set, and then add it to our object.
    if (typeof options.recordCallback !== undefined) {
      if (typeof options.recordCallback === 'function') {
        this.recordCallback = options.recordCallback;
      } else {
        throw new Error('recordCallback must be a function');
      }
    } else {
      this.recordCallback = undefined;
    }

    this.beginMs = Date.now();
    this.endMs = 0;

    this.opentracing = opentracing;
    // Allow the user to use their own version of opentracing
    if (options.opentracingModule) {
      this.opentracing = options.opentracingModule;
      this.recordInternalEvent('using external opentracing module');
    }
  }

  public isSampled(
    // span?: Span, parent?: Span
  ): boolean {
    // return this.sampleInstance.isSampled(span, parent);
    return true;
  }

  /**
   * Discard any buffered data.
   */
  public clear(): void {
    this._spans = [];
  }

  /**
   * Generate a uuid.v4
   *
   * Based on this gist https://gist.github.com/jed/982883
   *
   */
  public generateUUID(): string {
    // tslint:disable
    function generate(
      a?: any,                  // placeholder
    ) {
      return a           // if the placeholder was passed, return
        ? (              // a random number from 0 to 15
          a ^            // unless b is 8,
          Math.random() * 16  // in which case
          >> a / 4         // 8 to 11
        ).toString(16) // in hexadecimal
        : (              // or otherwise a concatenated string:
          "" +
          1e7 +        // 10000000 +
          -1e3 +         // -1000 +
          -4e3 +         // -4000 +
          -8e3 +         // -80000000 +
          -1e11          // -100000000000,
        ).replace(     // replacing
          /[018]/g,    // zeroes, ones, and eights with
          generate,            // random hex digits
        );
    }
    return generate();
    // tslint:enable
  }

  /**
   * Create a new span from a carrier
   * by default uses the text_map
   *
   */
  public join(operationName: string, carrier: any, format: string = 'text_map'): Span {
    const context: Context = this.extract(format, carrier);

    return this.startSpan(operationName, { childOf: context });
  }


  private recordInternalEvent(msg: string, payload?: any): void {
    this.internalEvents.push({
      msg,
      payload,
    });
  }

  /**
   * Return the buffered data in a format convenient for making unit test
   * assertions.
   */
  public record(span: Span): void {
    const report: any = {
      component: this.componentName ? this.componentName : undefined,
      operationName: span._operationName,
      startTime: span._startMs,
      finishMs: span._finishMs,
      duration: span.durationMs(),
      tags: span._tags,
      logs: span._logs,

      traceId: span.context().traceId,
      spanId: span.context().spanId,
      parentId: span.context().parentId,
      // sampled: span.sampled,
      baggage: span.context().baggage,
      referenceType: span.context().referenceType,
    };

    if (typeof this.recordCallback === undefined) {
      // curl
    } else {
      this.recordCallback(report);
    }
  }
}


// TODO: work out how to use this without breaking the tests
// export interface TracerConstructorOptions {
//   accessToken: string;
//   componentName: string;
//   recordCallback: any;
// }
