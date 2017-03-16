# hawkly tracer for javascript (opentracing)
[Repository](https://github.com/hawkly/hawkly-tracer-javascript) | [npm](https://www.npmjs.com/package/hawkly)

[![codecov](https://codecov.io/gh/hawkly/hawkly-tracer-javascript/branch/master/graph/badge.svg)](https://codecov.io/gh/hawkly/hawkly-tracer-javascript)
[![Build Status](https://travis-ci.org/hawkly/hawkly-tracer-javascript.svg?branch=master)](https://travis-ci.org/hawkly/hawkly-tracer-javascript)
[![NSP Status](https://nodesecurity.io/orgs/hawklyio/projects/dcb2409a-88c9-466d-bfc7-15b89417342d/badge)](https://nodesecurity.io/orgs/hawklyio/projects/dcb2409a-88c9-466d-bfc7-15b89417342d)
[![Known Vulnerabilities](https://snyk.io/test/npm/hawkly/badge.svg)](https://snyk.io/test/npm/hawkly)

*Work in progress*

This is a distrubuted tracing library that allows you to instrument your application.

```
yarn add --dev hawkly

// or

npm install --dev hawkly
```

## Concepts

Briefly, at the top level we have a `Trace`, which is comprised of `Spans`. `Spans` represent a single
unit of work. Exactly what a span is, is up to you. You want enough detail to understand your application,
but no so many that it's all noise.

To make a `Trace` you first create a `Span`. If the `Span` has no relationship it's automatically set
as the root `Span`. When you're ready to start another unit of work, you create another `Span` and link
it to the parent `Span`.

There are two types of links (also called references):
 - `childOf` where the child `Span` depends upon the parent `Span`, a blocking function such as a request/response,
 - `followsFrom` where the child `Span` does not depend unpon the parent `Span`, a non blocking function like emitting an event.

## Usage

hawkly tracer is built ontop of `opentracing`, so all the instrumentation you do is not unqiue to hawkly,
and will work if you switch your tracer to a something else that is opentracing compatible.

In order to record `spans`, you need to instiate a tracer.

```javascript
import Tracer from 'hawkly';

const tracer = new Tracer({
  // Get your accessToken from hawkly.io
  accessToken: 'yourAccessToken',
  // More on naming conventions below
  componentName: 'serviceName/functionName',

  // (Optional)
  // This callback is called just before sending a http request to record the span,
  // or if you passed the recordCallback callback, it's run just before that.
  // This gives you an opportunity to strip any information that should not be sent, such as
  // Personally Identifyable Information.
  // Be careful not to transform the shape of report though, as all fields are required.
  // The best approach is to replace it with 'REDACTED'.
  sanitiseCallback:(report) => {  },

  // (Optional)
  // You can provide your own recording callback.
  // This prevents a http request to hawkly.io, and lets you handle sending the spans
  // This is useful serverside as it lets you batch the requests before they're sent.
  recordCallback: (report) => {  },
});

// Create a new span, that represent a unit or work
const span = tracer.startSpan('someOperation');
// Optionally you can tag this span
span.tag('key', 'value')

// All your logging happends on the span.
// Pass an object with `event`, and `payload`, to the span.log() function, to record a log
span.log({
    event: 'read',
    payload: {duration: 1000},
})
// When the work is done, call .finish() to end the span, and send it off for recording.
span.finish();
```

### Related `Spans`

At it's most basic this is how to link spans together.

Remember to always `.finish()` the `Span` at the right time, otherwise the durations for the `Spans`
will not be accurate.

```javascript
// childOf
const parentSpan = tracer.startSpan('parentOperation');
const childSpan = tracer.startSpan('childOperation', {childOf: parentSpan});
childSpan.finish();
parentSpan.finish();

// childOf
const parentSpan = tracer.startSpan('parentOperation');
const childSpan = tracer.startSpan('childOperation', {followsFrom: parentSpan});
parentSpan.finish();
childSpan.finish();
```

The helper for `childOf` is part of the spec, but `followsFrom` is not. If you want to write the most portable instrumentation you can
alternitively write the following when you need a `followsFrom`, as it's part of the spec and will work with other tracers too.

```javascript
// Make sure you import opentracing
import opentracing from 'opentracing';

// create a tracer as you normally would, then create your followsFrom span like this:
tracer.startSpan("operation name", {
    references: [
      opentracing.followsFrom(parentContext),
      ],
  }
)
```


### How to cross a process boundary / Distributed Tracing

In order to maintain a trace between processes we need to inject some information your `carrier` on one side,
and extract it into a new `Span` on the other side.

The `carrier` refers to the message that is being sent between processes. It may be a HTTP request, response,
a message on a message queue, or something else.

At the moment, this tracer implementation only supports carriers that are `JSON` objects.

We don't inject the whole `Span` into the `carrier`, it's way to large. Instead we inject what we call
the span's `Context`. This is essentially a bunch of id's that allow us to link the spans together.


```javascript
// Process 1
const carrier: any = {};
const span: any = tracer.startSpan('someOperation');
tracer.inject(span, 'text_map', carrier);
span.finish();

// ---

// Process two

const carrier = JSON.parse(request);
const childSpan: any = tracer.join('childSpan', carrier, 'text_map');
// Do work
childSpan.finish();

```

When you use `tracer.join()` to create a new `Span` from the `Context` in the `carrier`;

### Typescript

If you're using Typescript you can import the source directly by using the following import:

```typescript
import {Tracer} from 'hawkly/src';
```

## Global Tracer

You can take advantage of a singleton in the `opentracing` module as follows:

```javascript
import Tracer from 'hawkly';
opentracing.initGlobalTracer(new Tracer());

const tracer = opentracing.globalTracer();

```

This allows you to initialise the hawkly tracer at the start of your application, and then just
import `opentracing` everywhere else. This makes it easy for you to switch tracing implementations
at a later date if you decide.

Also, by default the `opentracing` implementation is ` no-op`, meaning unless you supply it a tracer
with `.initGlobalTracer()` it will basically not do anything. This means you can disable tracing if
you wish.

### More information

API docs for `opentracing` and more information on the javascript implementation can be found here:
https://github.com/opentracing/opentracing-javascript

---
hawkly.io
Owen Kelly
