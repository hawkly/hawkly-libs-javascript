import * as createKeys from 'rsa-json';
import * as crypto from 'crypto';

import {
  Card,
  CardClassification,
  Guard,
  Warden,
} from './index';

import { test } from 'ava';

test('can encrypt and decrypt bearer token', async (t: any): Promise<void> => {
  const keys: any = await createAllKeys();
  console.log(keys)
  const uuid: string = '523b519b-cb8b-4fd5-8a46-ff4bab206fad';
  const tenant: string = '48d2d67d-2452-4828-8ad4-cda87679fc91';
  const roles: string[] = [
    'engineer',
    'onCall',
  ];

  const warden: Warden = new Warden(keys.privateKeys);
  const card: any = await warden.createCard({
    uuid,
    tenant,
    classification: CardClassification.access,
    roles,
  });
  console.log('card', card);

  const guard: Guard = new Guard(keys.publicKeys);

  try {
    const userCard: Card = await guard.checkCard(card);
    console.log('userCard', userCard);
    t.pass();
  } catch (err) {
    console.warn(err);
    t.fail(err.message);
  }

});



// Helpers

async function createNewKey(): Promise<any> {
  const keys: any = createKeys.native();
  // Keys are valid for 3 weeks (21 days), and should be rotated after 2 (14 days)
  const expires: any = new Date();
  expires.setTime(expires.getTime() + 21 * 86400000);

  return {
    keys,
    expires: expires.getTime(),
  };
}

// Helper function to generate a set of keys
async function createAllKeys(): Promise<any> {
  const rawKeys: any[] = await Promise.all([
    createNewKey(),
    createNewKey(),
    createNewKey(),
  ]);

  // Add a symmetric key to each key pair  
  const keys: any[] = rawKeys.map((key) => {
    return {
      ...key,
      symmetric: crypto.randomBytes(32).toString('hex'), // 256bit
      hmac: crypto.randomBytes(32).toString('hex'),     // 256bit
    };
  });

  const privateKeys: any[] = keys.map((key, i) => {
    // because this is the first time keys are being generated we need to emulate
    // the expiries as if the keys have been rotated.
    const dayMultiple = i + 1 * 7;
    const expires: any = new Date();
    expires.setTime(expires.getTime() + dayMultiple * 86400000);

    return {
      publicKey: key.keys.public,
      privateKey: key.keys.private,
      symmetric: key.symmetric,
      hmac: key.hmac,
      expires: expires.getTime(),
    };
  });

  const publicKeys: any[] = keys.map((key, i) => {
    // because this is the first time keys are being generated we need to emulate
    // the expiries as if the keys have been rotated.
    const dayMultiple = i + 1 * 7;
    const expires: any = new Date();
    expires.setTime(expires.getTime() + dayMultiple * 86400000);

    return {
      publicKey: key.keys.public,
      symmetric: key.symmetric,
      hmac: key.hmac,
      expires: expires.getTime(),
    };
  });

  return {
    privateKeys,
    publicKeys,
  };
}
