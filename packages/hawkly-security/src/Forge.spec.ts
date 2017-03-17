import { Forge, ForgeInitKeySet } from './Forge';

import { GuardKeySet } from './Guard';
import { WardenKeySet } from './Warden';
import { test } from 'ava';

test('can create a forge', (t: any) => {
  t.pass();
});

test('forge can create guardKeySet', (t: any) => {
  t.pass();
});

test('forge can create wardenKeySet', (t: any) => {
  t.pass();
});

test.only('forge can create complete keySetCollections', async (t: any) => {
  // Construct a new Forge
  const forge: Forge = new Forge();

  // Generate a brand new set of keySets
  const keySetCollection: ForgeInitKeySet = await forge.initKeySetCollections();

  let matchingKeys: number = 0;

  keySetCollection.wardenKeySetCollection.forEach((wardenKeySet: WardenKeySet) => {
    // Find the matching guardKeySet
    keySetCollection.guardKeySetCollection.forEach((guardKeySet: GuardKeySet) => {
      // Match the wardenKeySet with the guardKeySet based on the symmetric key matching
      if (wardenKeySet.symmetric === guardKeySet.symmetric) {
        // Log the match
        matchingKeys = matchingKeys + 1;
        // Now double check all the paired fields do actually match
        t.is(wardenKeySet.publicKey, guardKeySet.publicKey);
        t.is(wardenKeySet.symmetric, guardKeySet.symmetric);
        t.is(wardenKeySet.hmac, guardKeySet.hmac);
        t.is(wardenKeySet.expires, guardKeySet.expires);
      }
    });
  });

  // The number of matching keys should match the length of the keys generated
  t.true(matchingKeys === keySetCollection.wardenKeySetCollection.length);
  t.true(matchingKeys === keySetCollection.guardKeySetCollection.length);

});

test('forge can rotate keySetCollections', (t: any) => {
  t.pass();
});

test('', (t: any) => {
  t.pass();
});
