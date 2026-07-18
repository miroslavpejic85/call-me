'use strict';

/**
 * Call-Me Webhook Receiver (example)
 *
 * A tiny, dependency-free Node.js server that receives Call-Me webhook events,
 * verifies the optional HMAC-SHA256 signature, and logs each event.
 *
 * Run it in parallel with Call-Me to observe call lifecycle events live:
 *
 *   # optional: match the secret configured in Call-Me's .env (WEBHOOK_SECRET)
 *   WEBHOOK_SECRET='your-shared-secret' node webhook/server.js
 *
 * Then point Call-Me at it (.env):
 *   WEBHOOK_ENABLED=true
 *   WEBHOOK_URL='http://localhost:9000/webhooks/call-me'
 *   WEBHOOK_SECRET='your-shared-secret'
 */

const http = require('http');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT, 10) || 9099;
const PATH = process.env.WEBHOOK_PATH || '/webhooks/call-me';
const SECRET = process.env.WEBHOOK_SECRET || '';
// Reject bodies larger than this to avoid abuse (webhook payloads are tiny).
const MAX_BODY_BYTES = 64 * 1024;

// Verify the X-CallMe-Signature header against the raw request body.
function isValidSignature(rawBody, header) {
    if (!SECRET) return true; // signature verification disabled
    if (typeof header !== 'string') return false;
    const expected = 'sha256=' + crypto.createHmac('sha256', SECRET).update(rawBody).digest('hex');
    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    // timingSafeEqual throws if lengths differ, so guard first.
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Pretty-print a received event.
function logEvent(payload) {
    const { event, timestamp, data = {} } = payload;
    const time = new Date(timestamp || Date.now()).toISOString();

    switch (event) {
        case 'user.joined':
            console.log(`[${time}] user.joined   room=${data.room} user=${data.user}`);
            break;
        case 'user.left':
            console.log(`[${time}] user.left     room=${data.room} user=${data.user}`);
            break;
        case 'call.started':
            console.log(`[${time}] call.started  room=${data.room} caller=${data.caller} callee=${data.callee}`);
            break;
        case 'call.ended':
            console.log(
                `[${time}] call.ended    room=${data.room} caller=${data.caller} callee=${data.callee} duration=${data.durationSeconds}s`
            );
            break;
        default:
            console.log(`[${time}] ${event}`, data);
            break;
    }
}

const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== PATH) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
    }

    let raw = '';
    let tooLarge = false;

    req.on('data', (chunk) => {
        raw += chunk;
        if (raw.length > MAX_BODY_BYTES) {
            tooLarge = true;
            req.destroy();
        }
    });

    req.on('end', () => {
        if (tooLarge) return;

        // Verify authenticity before trusting the payload.
        if (!isValidSignature(raw, req.headers['x-callme-signature'])) {
            console.warn('Rejected webhook: invalid signature');
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid signature' }));
            return;
        }

        let payload;
        try {
            payload = JSON.parse(raw);
        } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
            return;
        }

        logEvent(payload);

        // Acknowledge quickly so Call-Me's fire-and-forget delivery completes.
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ received: true }));
    });
});

server.listen(PORT, () => {
    console.log(`Call-Me webhook receiver listening on http://localhost:${PORT}${PATH}`);
    console.log(`Signature verification: ${SECRET ? 'enabled' : 'disabled (set WEBHOOK_SECRET to enable)'}`);
});
