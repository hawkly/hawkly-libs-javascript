import * as crypto from 'crypto';

import {
  Card,
  CardClassification,
  CardClassificationExpiryLengths,
} from './index';

export class Guard {

  private keys: GuardKeySet[];

  constructor(keys: GuardKeySet[]) {
    if (Array.isArray(keys) === false) {
      throw new TypeError('key is not an array');
    }

    // Check the keys are of the correct type
    keys.forEach((key: GuardKeySet) => {
      if (typeof key.publicKey !== 'string') {
        throw new TypeError('A public key is not a string');
      }
      if (typeof key.symmetric !== 'string') {
        throw new TypeError('A symmetric key is not a string');
      }
      if (typeof key.hmac !== 'string') {
        throw new TypeError('A hmac key is not a string');
      }
      if (typeof key.expires !== 'number') {
        throw new TypeError('A key expires is not a number');
      }
    });


    this.keys = keys;
  }

  // Check the card is valid, and if it is return the card  
  public checkCard(cardString: string): Card {

    const cardBuffer = new Buffer(cardString, 'base64').toString('utf8');
    console.log('cardBuffer', cardBuffer);

    const cardArray: string[] = cardBuffer.split('.');
    const encrypted = cardArray[0];

    const hmac = cardArray[1];
    const keySet: GuardKeySet = this.checkHMAC(encrypted, hmac);

    console.log('keySet', keySet);
    const card: Card = JSON.parse(cardBuffer);

    const expiryTime: number = this.getClassificationExpiryTime(card.classification);
    if (expiryTime < card.issued) {
      throw new Error('Card has expired');
    }
    return card;
  }

  // Check the HMAC and if correct, return the keys used
  private checkHMAC(encrypted: string, HMAC: string): GuardKeySet {
    const keySet: GuardKeySet | undefined = this.keys.find(
      (keySet: GuardKeySet) => {
        const ourHMAC: string = crypto.createHmac(
          'sha256',
          keySet.hmac,
        )
          .update(encrypted)
          .digest('hex');

        if (
          crypto.timingSafeEqual(
            new Buffer(ourHMAC, 'hex'),
            new Buffer(HMAC, 'hex'),
          )
        ) {
          return true;
        }
        return false;
      });

    if (typeof keySet === undefined || keySet === undefined) {
      throw Error('Card is invalid');
    }
    return keySet;
  }


  private getClassificationExpiryTime(classification: CardClassification): number {
    const expires: Date = new Date();
    switch (classification) {
      case CardClassification.access:
        expires.setMinutes(expires.getMinutes() + CardClassificationExpiryLengths.access);
        return expires.getTime();

      case CardClassification.refresh:
        expires.setMinutes(expires.getMinutes() + CardClassificationExpiryLengths.refresh);
        return expires.getTime();

      case CardClassification.mfa:
        expires.setMinutes(expires.getMinutes() + CardClassificationExpiryLengths.mfa);
        return expires.getTime();

      default:
        throw new Error('Invalid card');
    }
  }
}

export interface GuardKeySet {
  publicKey: string;
  symmetric: string;
  hmac: string;
  // Keys are tried in order of newest to oldest
  expires: number;
}
