'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { FailedAttemptLimiter } = require('../app/failedAttemptLimiter');

test('blocks an IP after the configured number of failures', () => {
    let now = 1_000;
    const limiter = new FailedAttemptLimiter({ maxAttempts: 3, windowMs: 10_000, now: () => now });

    limiter.recordFailure('192.0.2.1');
    limiter.recordFailure('192.0.2.1');
    assert.equal(limiter.retryAfterMs('192.0.2.1'), 0);

    limiter.recordFailure('192.0.2.1');
    assert.equal(limiter.retryAfterMs('192.0.2.1'), 10_000);
    assert.equal(limiter.retryAfterMs('192.0.2.2'), 0);
});

test('expires failures after the window and supports reset after success', () => {
    let now = 1_000;
    const limiter = new FailedAttemptLimiter({ maxAttempts: 1, windowMs: 10_000, now: () => now });

    limiter.recordFailure('192.0.2.1');
    limiter.reset('192.0.2.1');
    assert.equal(limiter.retryAfterMs('192.0.2.1'), 0);

    limiter.recordFailure('192.0.2.1');
    now += 10_000;
    assert.equal(limiter.retryAfterMs('192.0.2.1'), 0);
});

test('disables limiting when max attempts is zero', () => {
    const limiter = new FailedAttemptLimiter({ maxAttempts: 0, windowMs: 10_000 });

    limiter.recordFailure('192.0.2.1');
    assert.equal(limiter.retryAfterMs('192.0.2.1'), 0);
});
