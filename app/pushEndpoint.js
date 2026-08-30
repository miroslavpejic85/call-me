'use strict';

const net = require('node:net');

const MAX_PUSH_ENDPOINT_LENGTH = 2048;
const MAX_PUSH_SUBSCRIPTIONS_PER_USER = 5;
const DEFAULT_TRUSTED_PUSH_ENDPOINT_HOSTS = [
    'fcm.googleapis.com',
    'updates.push.services.mozilla.com',
    'push.services.mozilla.com',
    'push.apple.com',
    'notify.windows.com',
];

function isValidPushEndpointHost(hostname) {
    return (
        net.isIP(hostname) === 0 &&
        hostname.length <= 253 &&
        /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(hostname)
    );
}

function parseTrustedPushEndpointHosts(value) {
    if (typeof value !== 'string' || value.trim() === '') {
        return [...DEFAULT_TRUSTED_PUSH_ENDPOINT_HOSTS];
    }

    return [
        ...new Set(
            value
                .split(',')
                .map((hostname) => hostname.trim().toLowerCase().replace(/\.$/, ''))
                .filter(isValidPushEndpointHost)
        ),
    ];
}

const TRUSTED_PUSH_ENDPOINT_HOSTS = parseTrustedPushEndpointHosts(process.env.PUSH_ALLOWED_ENDPOINT_HOSTS);

function isTrustedPushEndpoint(endpoint, trustedHosts = TRUSTED_PUSH_ENDPOINT_HOSTS) {
    if (typeof endpoint !== 'string' || endpoint.length === 0 || endpoint.length > MAX_PUSH_ENDPOINT_LENGTH) {
        return false;
    }

    try {
        const url = new URL(endpoint);
        if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
            return false;
        }

        const hostname = url.hostname.toLowerCase();
        return trustedHosts.some((trustedHost) => hostname === trustedHost || hostname.endsWith(`.${trustedHost}`));
    } catch {
        return false;
    }
}

module.exports = {
    isTrustedPushEndpoint,
    parseTrustedPushEndpointHosts,
    DEFAULT_TRUSTED_PUSH_ENDPOINT_HOSTS,
    MAX_PUSH_ENDPOINT_LENGTH,
    MAX_PUSH_SUBSCRIPTIONS_PER_USER,
};
