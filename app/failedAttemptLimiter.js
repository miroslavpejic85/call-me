'use strict';

class FailedAttemptLimiter {
    constructor({ maxAttempts, windowMs, now = Date.now }) {
        this.maxAttempts = maxAttempts;
        this.windowMs = windowMs;
        this.now = now;
        this.attempts = new Map();
        this.nextCleanupAt = 0;
    }

    retryAfterMs(key) {
        if (this.maxAttempts <= 0) return 0;

        const now = this.now();
        const attempt = this.attempts.get(key);
        if (!attempt || attempt.expiresAt <= now) {
            this.attempts.delete(key);
            return 0;
        }
        return attempt.count >= this.maxAttempts ? attempt.expiresAt - now : 0;
    }

    recordFailure(key) {
        if (this.maxAttempts <= 0) return;

        const now = this.now();
        if (now >= this.nextCleanupAt) {
            for (const [attemptKey, attempt] of this.attempts) {
                if (attempt.expiresAt <= now) this.attempts.delete(attemptKey);
            }
            this.nextCleanupAt = now + this.windowMs;
        }

        const current = this.attempts.get(key);
        if (!current || current.expiresAt <= now) {
            this.attempts.set(key, { count: 1, expiresAt: now + this.windowMs });
            return;
        }
        current.count++;
    }

    reset(key) {
        this.attempts.delete(key);
    }
}

module.exports = { FailedAttemptLimiter };
