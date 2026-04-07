'use strict';

// Service Worker for Web Push Notifications

// Activate immediately — don't wait for old clients to close
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
    console.log('Push event received');

    let title = 'Call-me';
    let body = 'You have a new notification';
    let url = '/';
    let type = 'notification';
    let caller = '';

    if (event.data) {
        try {
            const payload = event.data.json();
            title = payload.title || title;
            body = payload.body || body;
            url = payload.url || url;
            type = payload.type || type;
            caller = payload.caller || caller;
        } catch (e) {
            body = event.data.text() || body;
        }
    }

    const options = {
        body: body,
        icon: '/favicon/favicon-32x32.png',
        badge: '/favicon/favicon-16x16.png',
        // tag: 'call-me-' + type,
        // renotify: true,
        data: { url, type, caller },
    };

    console.log('Showing notification:', title, options);

    const promiseChain = self.registration
        .showNotification(title, options)
        .then(() => console.log('Notification shown successfully'))
        .catch((err) => console.error('showNotification failed:', err));

    event.waitUntil(promiseChain);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const url = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Try to focus an existing tab with the app
            for (const client of windowClients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.focus();
                    // Navigate to the call URL if different
                    if (url !== '/' && !client.url.includes(url)) {
                        client.navigate(self.location.origin + url);
                    }
                    return;
                }
            }
            // No existing tab found, open a new one
            return clients.openWindow(self.location.origin + url);
        })
    );
});

self.addEventListener('pushsubscriptionchange', (event) => {
    event.waitUntil(
        self.registration.pushManager
            .subscribe(event.oldSubscription.options)
            .then((subscription) => {
                // Notify the server about the new subscription
                return fetch('/api/v1/pushSubscription', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subscription }),
                });
            })
            .catch((err) => {
                console.error('Failed to resubscribe on pushsubscriptionchange:', err);
            })
    );
});
