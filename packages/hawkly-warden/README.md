# hawkly Warden

This is a very opinionated authentication and authorization token designed specifically for use with microservices.

## Goal

A cryptographically secure token that can be passed from an `authentication service` to an internal `service`
via a public untrusted medium (browser, mobile device).

The token functions as a bearer token, where the bearer of the token has access to the resources
avaible to the token.

The `authentication service` should be the only entity that can create the tokens, but any
internal `service` should be able to decrypt the token, read it's content, and verify that
the contents were created by `authentication service`.

## Design

Assumptions:
There a a set of key pairs.
Each key pair contains a `private`, `public` and `symmetric` key.

`authentication service` is the sole holder of the `private` keys.
All `services` are holders of the `public` and `symmetric` keys.
Clients (browsers/mobile) hold no keys, but do transit the token.

*Warden*
1. Create a `Card`, which contains information about the user, and their roles.
2. Choose a `keySet`.
3. Sign the `Card` with the private key `keySet.privateKey`.
4. Encrypt the `Card` and `signature` (from #3) with a shared key `keySet.symmetric`.
5. Create a HMAC for the the encrypted `Card` + `signature` (result of #4).
6. Concatenate `encrypted` and `hmac` into `encrypted.hmac`.

*Guard*
1. Split into `encrypted` and `hmac`.
2. Check HMAC for `hmac` with all keys in the keySets, if valid return the keySet (else card invalid)
3. Decrypt `encrypted` with `keySet` from #2.
4. Check signature from result of #3 with `key.publicKey` from the `keySet` from #2.
5. Hydrate the `Card` (property names are shrunk when sent on the wire).
6. Check the `Card` has not expired.
7. Return the `Card` object.

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
  publicKey: 'string',    // RSA public key
  privateKey: 'string',   // RSA private key
  symmetric: 'string',    // 256 bit string
  hmac: 'string',         // 256 bit string
  expires: 1490248396257, // unix timestamp
}
```

The key sets look like:
```javascript

privateKeys: [
    {
        publicKey: '-----BEGINRSAPUBLICKEY-----\-----ENDRSAPUBLICKEY-----\n',
        privateKey: '-----BEGINRSAPRIVATEKEY-----\-----ENDRSAPRIVATEKEY-----\n',
        symmetric: 'bcd981873d8a601e0a8a19509197493234af5b51a39f81746e78799dc10b206d',
        hmac: 'da189f4172cb954dba6817376a09ff9334c39a13817beaf7ab8453705f0fe4d9',
        expires: 1490248396257
    },
    {
        publicKey: '-----BEGINRSAPUBLICKEY-----\-----ENDRSAPUBLICKEY-----\n',
        privateKey: '-----BEGINRSAPRIVATEKEY-----\-----ENDRSAPRIVATEKEY-----\n',
        symmetric: 'adb6c33e3c1dbaf7e711521a0f9705e5bb657c6e7b97be5dfe9b81bb8f0a6791',
        hmac: '70d03b7ded2cafe0ff4d29fa5cfbf3e8e9c3828d95a4477b80c3de4ee97a3b50',
        expires: 1490248396257
    },
    {
        publicKey: '-----BEGINRSAPUBLICKEY-----\-----ENDRSAPUBLICKEY-----\n',
        privateKey: '-----BEGINRSAPRIVATEKEY-----\-----ENDRSAPRIVATEKEY-----\n',
        symmetric: 'c834d9ac4ee33ebd3a4063a862b48187f70dc0ae0722850d88b54e4990750023',
        hmac: '030c16bb3cf106ebf4f0f2ff9e1270dbc90bf9a9b6d08bcd133dbb27ec7cc62a',
        expires: 1490421196257
    },
]

publicKeys: [
    {
        publicKey: '-----BEGINRSAPUBLICKEY-----\-----ENDRSAPUBLICKEY-----\n',
        symmetric: 'bcd981873d8a601e0a8a19509197493234af5b51a39f81746e78799dc10b206d',
        hmac: 'da189f4172cb954dba6817376a09ff9334c39a13817beaf7ab8453705f0fe4d9',
        expires: 1490248396257
    },
    {
        publicKey: '-----BEGINRSAPUBLICKEY-----\-----ENDRSAPUBLICKEY-----\n',
        symmetric: 'adb6c33e3c1dbaf7e711521a0f9705e5bb657c6e7b97be5dfe9b81bb8f0a6791',
        hmac: '70d03b7ded2cafe0ff4d29fa5cfbf3e8e9c3828d95a4477b80c3de4ee97a3b50',
        expires: 1490334796257
    },
    {
        publicKey: '-----BEGINRSAPUBLICKEY-----\-----ENDRSAPUBLICKEY-----\n',
        symmetric: 'c834d9ac4ee33ebd3a4063a862b48187f70dc0ae0722850d88b54e4990750023',
        hmac: '030c16bb3cf106ebf4f0f2ff9e1270dbc90bf9a9b6d08bcd133dbb27ec7cc62a',
        expires: 1490421196257
    }
]
```

`privateKeys` *must* only be accessible by `authentication service` and
`publicKeys` *must* only be accessible by internal services.

---
hawkly.io
Owen Kelly
