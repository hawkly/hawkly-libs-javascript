import * as opentracing from 'opentracing';

/**
 *
 *
 */
export class Context extends opentracing.SpanContext {

  public baggage: [any];

  // this spans uuid
  public spanId: string;

  // a uuid from the root span
  public traceId: string;

  // a uuid for the direct parent
  // it's the same as spanId when there is no parent
  public parentId: string;

  // childOf or followsFrom
  public referenceType: string;

  // Whether or not this trace should be sampled
  public sampled: boolean = true;

  constructor(spanId: string, parentId: string, traceId: string, referenceType?: string, baggage?: any) {
    super();
    this.spanId = spanId;
    this.parentId = parentId;
    this.traceId = traceId;
    if (referenceType === 'childOf' || referenceType === 'child_of') {
      this.referenceType = 'childOf';
    } else if (referenceType === 'followsFrom' || referenceType === 'follows_from') {
      this.referenceType = 'followsFrom';
    } else {
      this.referenceType = 'root';
    }
    this.baggage = baggage;
  }

  // baggage currently not implemented
  // public forEachBaggageItem(f) {
  //   this.baggage.forEach((val: any, key: any) => {
  //     f(key, val);
  //   });
  // }
}
