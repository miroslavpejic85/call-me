# Call-Me Webhooks

Get notified of call lifecycle events in real time for external integrations (CRM, analytics, logging, notifications). When enabled, `Call-Me` sends an HTTP `POST` to your endpoint for each event.

## Enable it

In your `Call-Me` `.env`:

```shell
WEBHOOK_ENABLED=true
WEBHOOK_URL='http://localhost:9000/webhooks/call-me'
WEBHOOK_SECRET='your-shared-secret' # optional, enables request signing
WEBHOOK_TIMEOUT_MS=5000
```

## Events

| Event          | Fired when                          | `data` payload                              |
| -------------- | ----------------------------------- | ------------------------------------------- |
| `user.joined`  | A user signs in to a room           | `{ room, user }`                            |
| `user.left`    | A user disconnects from a room      | `{ room, user }`                            |
| `call.started` | A call is established between peers  | `{ room, caller, callee }`                  |
| `call.ended`   | A call ends (hang up or disconnect) | `{ room, caller, callee, durationSeconds }` |

## Payload

Every request body has the same envelope:

```json
{
    "event": "call.ended",
    "timestamp": 1752835200000,
    "data": {
        "room": "Support",
        "caller": "user1",
        "callee": "user2",
        "durationSeconds": 142
    }
}
```

## Verifying the signature

If `WEBHOOK_SECRET` is set, each request includes an `X-CallMe-Signature` header in the form `sha256=<hex>`, which is the `HMAC-SHA256` of the raw JSON body. Verify it to ensure authenticity:

```js
const crypto = require('crypto');

function isValidSignature(rawBody, header, secret) {
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}
```

> [!NOTE]
> Since `Call-Me` is peer-to-peer, `durationSeconds` reflects the signaling session lifetime (from call establishment to hang up/disconnect), accurate to within a second of the actual media time.

## Example receiver

[`server.js`](./server.js) is a tiny, dependency-free Node.js server that receives events, verifies the signature, and logs each one. Run it in parallel with `Call-Me` to watch events live:

```shell
# From the project root (no npm install needed)
node webhook/server.js

# Or with signature verification (must match Call-Me's WEBHOOK_SECRET)
WEBHOOK_SECRET='your-shared-secret' node webhook/server.js
```

It listens on `http://localhost:9000/webhooks/call-me` by default. Override with `PORT`, `WEBHOOK_PATH`, and `WEBHOOK_SECRET` environment variables.

Example output:

```text
Call-Me webhook receiver listening on http://localhost:9000/webhooks/call-me
Signature verification: enabled
[2026-07-18T10:00:00.000Z] user.joined   room=Support user=user1
[2026-07-18T10:00:05.000Z] user.joined   room=Support user=user2
[2026-07-18T10:00:07.000Z] call.started  room=Support caller=user1 callee=user2
[2026-07-18T10:02:29.000Z] call.ended    room=Support caller=user1 callee=user2 duration=142s
[2026-07-18T10:02:30.000Z] user.left     room=Support user=user2
```
