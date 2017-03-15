import * as opentracing from 'opentracing';

import { Context } from './Context';
import { Tracer } from './Tracer';

export interface HawklyLog {
  event: string;
  payload?: any;
  timestamp: number;
}
/**
 * OpenTracing Span implementation designed for use in unit tests.
 */
export class Span extends opentracing.Span {

  public _tracer: Tracer;
  public _startMs: number;
  public _finishMs: number;
  public _duration: number;
  public _operationName: string;
  public _tags: any;
  public _logs: HawklyLog[];
  public _baggage: any;
  public _sampled: boolean;
  public _ctx: Context;

  public record: any;

  public log: any;
  public finish: any;
  public setTag: any;

  constructor(
    tracer: Tracer,
    name: string,
    context: Context,
    options: {
      startTime: number,
      tags: any,
    },
  ) {
    super();
    this._tracer = tracer;
    this._operationName = name;
    this._ctx = context;

    this._sampled = this._tracer.isSampled();
    this._baggage = {};

    this._startMs = options.startTime;
    this._tags = options.tags;
  }

  public context(): Context {
    return this._context();
  }

  public _context(): Context {
    return this._ctx;
  }

  public _log(fields: any, timestamp: number): void {
    if (typeof fields !== 'object') {
      throw new Error('Span.log() expects an object as its first argument');
    }
    if (typeof fields.event !== 'string') {
      throw new Error('Span.log() must contain an event name. For example Span.Log({event: \'eventName\')');
    }

    const record: HawklyLog = {
      event: fields.event,
      timestamp: typeof timestamp === 'number' ? timestamp : Date.now(),
    };
    if (typeof fields.payload !== undefined) {
      record.payload = fields.payload;
    }

    if (typeof this._logs === undefined || !(this._logs instanceof Array)) {
      this._logs = [record];
    } else {
      this._logs.push(record);
    }
  }

  // Add tags
  public _addTags(tags: any): void {
    const keys: any = Object.keys(tags);
    [...Array(keys.length)].forEach((_: any, i: number) => {
      const key: string = keys[i];
      this._tags[key] = tags[key];
    });
  }

  public _finish(finishTime: number): void {
    this._finishMs = finishTime || Date.now();
    this._duration = this._finishMs - this._startMs;
    this._tracer.record(this);
  }

  public durationMs(): number {
    return this._finishMs - this._startMs;
  }
}
