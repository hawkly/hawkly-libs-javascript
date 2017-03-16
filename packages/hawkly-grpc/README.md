# hawkly gRPC wrapper for javascript
[Repository](https://github.com/hawkly/hawkly-grpc-javascript) | [npm](https://www.npmjs.com/package/hawkly-grpc)

*Work in progress*

This is a wrapper around gRPC to add opentracing and async/await.

## Usage


### Server

To run the server, add the `hawklyMiddleware` with configuration as a middleware to `Mali`.

```javascript
  const PROTO_PATH: string = __dirname + '/../proto/helloworld.proto';

  const grpcHost = '0.0.0.0:1000';
  const app: Mali = new Mali(PROTO_PATH);

  const hawklyTracerOptions: any = {
    accessToken: 'test',
    componentName: 'testServerComponent',
  };


  app.use(hawklyMiddleware(hawklyTracerOptions));

  app.use({
    sayHello: () => {
      // handler code
    }
  });
  app.start(grpcHost);
  ```

### Client

We provide a wrapper for the grpc client (based on a rewrite of https://www.npmjs.com/package/grpc-caller), which will automatically create a `span` and add it's context to the outgoing grpc call.

To create a client you need to pass options to instantiate both the Hawkly `Tracer` and the grpc `client`.

```javascript
import {
  // Use this to create a new gRPC client from a proto file
  // This lets you call the services defined in the proto file
  createClient,
} from 'hawkly-grpc';

// defince your proto path
const PROTO_PATH: string = __dirname + '/helloworld.proto';

// create the client and tracer
const { tracer, client } = createClient(
  {
    // hawkly
    accessToken: 'get your token from hawkly.io',
    componentName: 'myComponent',
    // grpc
    host: grpcHost,
    proto: PROTO_PATH,
    name: 'Greeter',
  },
);

  // Create a new span to cover this unit of work
  const span: any = tracer.startSpan('myFirstSpan');

  // await the result of our gRPC call to `sayHello`
  // and an object of options to the call to specify the arg etc
  const request:Promise<any> = await client.sayHello({
    arg: { name: grpcHost },
    // pass the span we just created
    span,
  });

  // do stuff with result

  // finish our span
  span.finish();


```

#### Get the request `Span`
If you need access to the `Span` created for the request, you can pass in `requestSpan:true` to the options of the call.
This will return you a tuple with `request` as a Promise and `requestSpan` and `span` as the span (both exist so you can use destructuring
without having a local variable conflict with `span`).

```javascript
import {
  // Use this to create a new gRPC client from a proto file
  // This lets you call the services defined in the proto file
  createClient,
  // request interface type
  TracedUnaryRequest,
} from 'hawkly-grpc';

  // await the result of our gRPC call to `sayHello`
  // and an object of options to the call to specify the arg etc
  const {request, requestSpan}:TracedUnaryRequest = await client.sayHello({
    arg: { name: grpcHost },
    // pass the span we just created
    span,
    requestSpan: true,
  });
  const result:any = await request;

```

### Errors

To simplify error handling for errors raised specifically in the server handler code we export an error type `HawklyError`.

When you throw it in your rpc handler it will be returned to the caller and instatiated as a `HawklyError` on the caller side.

```javascript
   function sayHello() {
      throw new HawklyError('This is a test error', 'testError', { foo: 'bar' });
    }

      try {
        const result: any = await client.sayHello({
          arg: { name: grpcHost },
          // pass in our span
          span,
        });
        // do something with result
      } catch (error) {
        if(error instanceof HawklyError){
          // error throw by server rpc
          console.log(error.getMessage());   // 'This is a test error'
          console.log(error.getEventName()); //'testError'
          console.log(error.getPayload());   //{ foo: 'bar' }
        } else {
          // any other grpc error
        }
      }
```

### More information

http://www.grpc.io/

---
hawkly.io
Owen Kelly
