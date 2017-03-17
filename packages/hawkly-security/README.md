# hawkly security

This is a very opinionated authentication and authorization token/`Card` designed specifically for use with zero-trust microservices.

It has a specific problem to solve, and outside of that scope is most likely not the right tool for your system. If however, it does look like the right tool you need to be able to ensure proper key managemnt and regular automatic key rotation for your implementation to be safe, secure and successful.

## Goal

A cryptographically secure token that can be passed from an `authentication service` to an internal `service`
via a public untrusted medium (browser, mobile device).

The `Card` functions as a bearer token, where the bearer of the token/`Card` has access to the resources
avaible to the `Card`.

The `authentication service` should be the only entity that can create the `Card`, but any
internal `service` should be able to decrypt the token, read it's content, and verify that
the contents were created by `authentication service`.

## Getting Started

First, you need to work out how you will generated 



## Design

The `Card` is designed with a few layers for specific functions. From the inside out we have a JSON object representing the actual contents.

First we sign the contents of the `Card` object (specifically we stringify the object, then sign the resulting string).

We encrypt the `Card` and the `signature` with authentitcated encryption with a key shared between services, so our other services can decrypt it. We use authenticated encryption to ensure; the contents can only be read by
our services, the integrity of the contents is assured, we have assurance that the contents was encrypted by us (that is, by any service with the key), and by signing it with the `private key`, we have assurance that it could only have come from the `authentication service`.

The authenticated encrypted uses an Initialisation Vector (`iv`) and outputs an `encrypted chunk` and
an `authorisation tag`.

We concatencate these together with periods (`.`) and sign the result with the
private key (only held by the `authentication service`). This provides a guareentee that the encrypted contents of the `Card` we're created by `authentication service` (as that's the only service with the
private key).


We then HMAC that. This guarentees that the contents has not been modified in transit.


Assumptions:
There a a set of key pairs.
Each key pair contains a `private`, `public` and `symmetric` key.

`authentication service` is the sole holder of the `private` keys.
All `services` are holders of the `public` and `symmetric` keys.
Clients (browsers/mobile) hold no keys, but do transit the token.

### Protocol

*Warden*

**A Warden can issue cards to users.**

1. Create a `Card`, which contains information about the user, and their roles.
2. Choose a `keySet`.
3. Sign the `Card` with the private key `keySet.privateKey`.
4. Encrypt the `Card` and `signature` (from #3) with a shared key `keySet.symmetric`.
5. Create a HMAC for the the encrypted `Card` + `signature` (result of #4).
6. Concatenate `encrypted` and `hmac` into `encrypted.hmac`.

*Guard*

**A Guard can verify the authenticity and integrity of a card, and return the information stored on
that card.**

1. Split into `encrypted` and `hmac`.
2. Check HMAC for `hmac` with all keys in the keySets, if valid return the keySet (else card invalid)
3. Decrypt `encrypted` with `keySet` from #2.
4. Check signature from result of #3 with `key.publicKey` from the `keySet` from #2.
5. Hydrate the `Card` (property names are shrunk when sent on the wire).
6. Check the `Card` has not expired.
7. Return the `Card` object.


*In practice*

1. The `token` is created by the `authentication service`.
2. The `token` is delivered to the users browser as a `HttpOnly` cookie.
  - There is no reason or need for the browser to read the `token`, as it should be completely
  opaque and unreadable. The browser will know the `token` is correct based on the response from
  calling services with the `token`.
3. The `token` is passed from the browser to a `service`.
4. The `service` first checks the authenticity of the `token`, that it was created by `authentication service`.
5. Then the `service` decrypts the payload of the `token`, revealing some information about the user.

## Concept

You create a new card by asking the Warden for one. You have extremely limited configuration options.

Card types:
 - Access token
 - Refresh token
 - mfa Challenge token

## Requirements

You need to manage a 2 key sets. One for your `authentication service`, and one for
all your other `services`. They will be identical except, the `authentication service`
will contain a private key.

A single `keyset` contains the following:
```javascript
{
  publicKey:  'string',    // RSA public key
  privateKey: 'string',   // RSA private key
  symmetric:  'string',    // 256 bit string
  hmac:       'string',         // 256 bit string
  expires:    1490248396257, // unix timestamp
}
```

The key sets look like:
```javascript

wardenKeySetCollection: [
    {
        publicKey:  '-----BEGINRSAPUBLICKEY-----\-----ENDRSAPUBLICKEY-----\n',
        privateKey: '-----BEGINRSAPRIVATEKEY-----\-----ENDRSAPRIVATEKEY-----\n',
        symmetric:  'bcd981873d8a601e0a8a19509197493234af5b51a39f81746e78799dc10b206d',
        hmac:       'da189f4172cb954dba6817376a09ff9334c39a13817beaf7ab8453705f0fe4d9',
        expires:    1490248396257
    },
    {
        publicKey:  '-----BEGINRSAPUBLICKEY-----\-----ENDRSAPUBLICKEY-----\n',
        privateKey: '-----BEGINRSAPRIVATEKEY-----\-----ENDRSAPRIVATEKEY-----\n',
        symmetric:  'adb6c33e3c1dbaf7e711521a0f9705e5bb657c6e7b97be5dfe9b81bb8f0a6791',
        hmac:       '70d03b7ded2cafe0ff4d29fa5cfbf3e8e9c3828d95a4477b80c3de4ee97a3b50',
        expires:    1490248396257
    },
    {
        publicKey:  '-----BEGINRSAPUBLICKEY-----\-----ENDRSAPUBLICKEY-----\n',
        privateKey: '-----BEGINRSAPRIVATEKEY-----\-----ENDRSAPRIVATEKEY-----\n',
        symmetric:  'c834d9ac4ee33ebd3a4063a862b48187f70dc0ae0722850d88b54e4990750023',
        hmac:       '030c16bb3cf106ebf4f0f2ff9e1270dbc90bf9a9b6d08bcd133dbb27ec7cc62a',
        expires:     1490421196257
    },
]

guardKeySetCollection: [
    {
        publicKey: '-----BEGINRSAPUBLICKEY-----\-----ENDRSAPUBLICKEY-----\n',
        symmetric: 'bcd981873d8a601e0a8a19509197493234af5b51a39f81746e78799dc10b206d',
        hmac:      'da189f4172cb954dba6817376a09ff9334c39a13817beaf7ab8453705f0fe4d9',
        expires:    1490248396257
    },
    {
        publicKey: '-----BEGINRSAPUBLICKEY-----\-----ENDRSAPUBLICKEY-----\n',
        symmetric: 'adb6c33e3c1dbaf7e711521a0f9705e5bb657c6e7b97be5dfe9b81bb8f0a6791',
        hmac:      '70d03b7ded2cafe0ff4d29fa5cfbf3e8e9c3828d95a4477b80c3de4ee97a3b50',
        expires:    1490334796257
    },
    {
        publicKey: '-----BEGINRSAPUBLICKEY-----\-----ENDRSAPUBLICKEY-----\n',
        symmetric: 'c834d9ac4ee33ebd3a4063a862b48187f70dc0ae0722850d88b54e4990750023',
        hmac:      '030c16bb3cf106ebf4f0f2ff9e1270dbc90bf9a9b6d08bcd133dbb27ec7cc62a',
        expires:    1490421196257
    }
]
```

`privateKeys` *must* only be accessible by `authentication service` and
`publicKeys` *must* only be accessible by internal services.


TODO: examples with full docker/docker-compose examples of `forge service` container, `auth service` container, and `service` container.

---
hawkly.io
Owen Kelly
