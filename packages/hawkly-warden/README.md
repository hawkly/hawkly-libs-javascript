# hawkly warden

## Goal

A cryptographically secure token that can be passed from an authentication service to a browser,
and then sent to microservices with a request, where the microservices can independent of the
authentication service, verfiy and decrypt the token.

## Design

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

---
hawkly.io
Owen Kelly
