import * as Debug from 'debug';

// Import our gRPC client
import {
  TracedDuplexStream,
  TracedRequestStream,
  TracedResponseStream,
  TracedUnaryRequest,
  createClient,
} from './client';
// Import the hawkly middleware for the gRPC server for node Mali
import { hawklyKoaMiddleware, hawklyMaliMiddleware } from './middleware';

const debug: any = Debug('hawkly');

class HawklyError extends Error {
  public eventName: string;
  public payload: {} | undefined;
  /**
   *
   * @param message   A short message that is returned to the caller      (not logged on span)
   * @param eventName A very short eventName that is saved onto the span  (logged on span)
   * @param payload (optional) object that is returned to the caller      (logged on span)
   */
  constructor(message: string, eventName: string, payload?: {}) {
    super(message);
    if (typeof eventName !== 'string') {
      throw new Error(`eventName must be a string, got ${typeof eventName}`);
    }
    this.eventName = eventName;
    this.payload = payload;
    debug(
      // tslint:disable-next-line:no-multiline-string
      `===============================[ HawklyError ]\n`
      + `Event: ${eventName} \n`
      + `Message: ${message} \n`
      + `Payload: ${JSON.stringify(payload, undefined, 4)} \n`
      + `Stack ${this.stack}\n`
      // tslint:disable-next-line:no-multiline-string
      + `_______________________________________________________________________________________\n`,
    );
  }
  public getPayloadJSON(): string | undefined {
    return JSON.stringify(this.payload);
  }
}


export {
  hawklyMaliMiddleware,
  hawklyKoaMiddleware,
  createClient,
  TracedUnaryRequest,
  TracedRequestStream,
  TracedResponseStream,
  TracedDuplexStream,
  HawklyError
};
