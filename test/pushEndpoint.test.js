'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    isTrustedPushEndpoint,
    parseTrustedPushEndpointHosts,
    DEFAULT_TRUSTED_PUSH_ENDPOINT_HOSTS,
    MAX_PUSH_ENDPOINT_LENGTH,
} = require('../app/pushEndpoint');

test('uses built-in push service hosts when the environment value is unset or blank', () => {
    assert.deepEqual(parseTrustedPushEndpointHosts(), DEFAULT_TRUSTED_PUSH_ENDPOINT_HOSTS);
    assert.deepEqual(parseTrustedPushEndpointHosts('  '), DEFAULT_TRUSTED_PUSH_ENDPOINT_HOSTS);
});

test('parses and normalizes a configured push service host override', () => {
    assert.deepEqual(parseTrustedPushEndpointHosts('Push.Example.com, push.example.com., invalid, 127.0.0.1'), [
        'push.example.com',
    ]);
    assert.equal(isTrustedPushEndpoint('https://push.example.com/delivery', ['push.example.com']), true);
    assert.equal(isTrustedPushEndpoint('https://fcm.googleapis.com/fcm/send/token', ['push.example.com']), false);
});

test('accepts HTTPS endpoints from supported browser push services', () => {
    const endpoints = [
        'https://fcm.googleapis.com/fcm/send/token',
        'https://updates.push.services.mozilla.com/wpush/v2/token',
        'https://web.push.apple.com/QH-token',
        'https://wns2-par02p.notify.windows.com/w/?token=value',
    ];

    for (const endpoint of endpoints) {
        assert.equal(isTrustedPushEndpoint(endpoint), true, endpoint);
    }
});

test('rejects endpoints outside trusted push service domains', () => {
    const endpoints = [
        'https://attacker.example/callback',
        'https://127.0.0.1/internal',
        'https://169.254.169.254/metadata',
        'https://fcm.googleapis.com.attacker.example/callback',
        'https://notfcm.googleapis.com/callback',
    ];

    for (const endpoint of endpoints) {
        assert.equal(isTrustedPushEndpoint(endpoint), false, endpoint);
    }
});

test('rejects unsafe URL forms and oversized endpoints', () => {
    const endpoints = [
        'http://fcm.googleapis.com/fcm/send/token',
        'https://user@fcm.googleapis.com/fcm/send/token',
        'https://fcm.googleapis.com:8443/fcm/send/token',
        'not a URL',
        '',
        null,
        `https://fcm.googleapis.com/${'a'.repeat(MAX_PUSH_ENDPOINT_LENGTH)}`,
    ];

    for (const endpoint of endpoints) {
        assert.equal(isTrustedPushEndpoint(endpoint), false, String(endpoint));
    }
});
