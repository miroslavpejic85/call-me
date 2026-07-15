'use strict';

// Import necessary modules
const dotenv = require('dotenv').config();

// Sentry (initialize before all other modules so it can instrument them)
const Sentry = require('@sentry/node');
const sentryEnabled = process.env.SENTRY_ENABLED === 'true';
const sentryDsn = process.env.SENTRY_DSN;
const sentryTracesSampleRate = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.5;

if (sentryEnabled && sentryDsn && sentryDsn !== '') {
    Sentry.init({
        dsn: sentryDsn,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: sentryTracesSampleRate,
    });
}

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const httpolyglot = require('httpolyglot');
const ngrok = require('@ngrok/ngrok');
const socketIO = require('socket.io');
const axios = require('axios');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const yaml = require('js-yaml');
const swaggerUi = require('swagger-ui-express');
const webpush = require('web-push');
const packageJson = require('../package.json');

// Logs
const logs = require('./logs');
const log = new logs('server');

// Middlewares
const { applyEmbedHeaders, embedAllowedOrigins, embedCsp } = require('./middleware/embedHeaders');

//log.error('Sentry test error', new Error('This is a test error to verify Sentry integration'));

// Public directory location
const PUBLIC_DIR = path.join(__dirname, '../', 'public');

// Home page/client
const HOME = path.join(PUBLIC_DIR, '/index.html');

// Privacy page
const PRIVACY = path.join(PUBLIC_DIR, '/privacy.html');

// Locales directory location
const LOCALES_DIR = path.join(__dirname, 'locales');

function getAvailableLocales() {
    try {
        return fs
            .readdirSync(LOCALES_DIR, { withFileTypes: true })
            .filter((dirent) => dirent.isFile() && dirent.name.endsWith('.json'))
            .map((dirent) => path.basename(dirent.name, '.json'))
            .filter(Boolean)
            .sort();
    } catch (error) {
        log.warn('Unable to read locales directory', {
            directory: LOCALES_DIR,
            error: error.message,
        });
        return [];
    }
}

// Default room used when no room name is provided (preserves single-lobby behavior)
const DEFAULT_ROOM = 'public';

// Map to store connected users (key: room+username composite, value: socket)
const users = new Map();

// Map to store user media status (key: room+username composite)
const userMediaStatus = new Map();

// Map to store push subscriptions (key: room+username composite -> PushSubscription[])
const pushSubscriptions = new Map();

// Map to track concurrent Socket.IO connections per client IP (anti-abuse)
const socketConnectionsPerIp = new Map();

// Configuration settings
const config = {
    iceServers: [],
    stunServerEnabled: process.env.STUN_SERVER_ENABLED === 'true',
    stunServerUrl: process.env.STUN_SERVER_URL,
    turnServerEnabled: process.env.TURN_SERVER_ENABLED === 'true',
    turnServerUrl: process.env.TURN_SERVER_URL,
    turnServerUsername: process.env.TURN_SERVER_USERNAME,
    turnServerCredential: process.env.TURN_SERVER_CREDENTIAL,
    hostPasswordEnabled: process.env.HOST_PASSWORD_ENABLED === 'true',
    hostPassword: process.env.HOST_PASSWORD || '',
    apiKeySecret: process.env.API_KEY_SECRET,
    pushEnabled: process.env.PUSH_ENABLED === 'true',
    pushVapidPublicKey: process.env.PUSH_VAPID_PUBLIC_KEY || '',
    pushVapidPrivateKey: process.env.PUSH_VAPID_PRIVATE_KEY || '',
    pushVapidEmail: process.env.PUSH_VAPID_EMAIL || 'mailto:admin@example.com',
    randomImageUrl: process.env.RANDOM_IMAGE_URL || '',
    ringTimeout: parseInt(process.env.RINGING_TIMEOUT, 10) || 30,
    // Anti-abuse / rate limiting
    rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60 * 1000,
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 300,
    socketMaxConnectionsPerIp: parseInt(process.env.SOCKET_MAX_CONNECTIONS_PER_IP, 10) || 20,
    socketRateLimitWindowMs: parseInt(process.env.SOCKET_RATE_LIMIT_WINDOW_MS, 10) || 10 * 1000,
    socketRateLimitMax: parseInt(process.env.SOCKET_RATE_LIMIT_MAX, 10) || 100,
    apiBasePath: '/api/v1',
    swaggerDocument: yaml.load(fs.readFileSync(path.join(__dirname, '/api/swagger.yaml'), 'utf8')),
};

// If no room password is specified, a random one is generated (if room password is enabled)
config.hostPassword = process.env.HOST_PASSWORD || (config.hostPasswordEnabled ? generatePassword() : '');

// Add STUN server if enabled and URL is provided
if (config.stunServerEnabled && config.stunServerUrl) {
    config.iceServers.push({ urls: config.stunServerUrl });
}

// Add TURN server if enabled and all required information is provided
if (config.turnServerEnabled && config.turnServerUrl && config.turnServerUsername && config.turnServerCredential) {
    config.iceServers.push({
        urls: config.turnServerUrl,
        username: config.turnServerUsername,
        credential: config.turnServerCredential,
    });
}

// Configure Web Push if enabled
if (config.pushEnabled && config.pushVapidPublicKey && config.pushVapidPrivateKey) {
    webpush.setVapidDetails(config.pushVapidEmail, config.pushVapidPublicKey, config.pushVapidPrivateKey);
    log.info('Web Push', { enabled: true });
} else if (config.pushEnabled) {
    log.warn('Web Push', { enabled: false, reason: 'VAPID keys not configured. Run: npm run generate-vapid-keys' });
    config.pushEnabled = false;
}

const ngrokEnabled = process.env.NGROK_ENABLED === 'true';
const ngrokAuthToken = process.env.NGROK_AUTH_TOKEN;

// Handle Cors

const cors_origin = process.env.CORS_ORIGIN;
const cors_methods = process.env.CORS_METHODS;

let corsOrigin = '*';
let corsMethods = ['GET', 'POST'];

if (cors_origin && cors_origin !== '*') {
    try {
        corsOrigin = JSON.parse(cors_origin);
    } catch (error) {
        log.error('Error parsing CORS_ORIGIN', error.message);
    }
}

if (cors_methods && cors_methods !== '') {
    try {
        corsMethods = JSON.parse(cors_methods);
    } catch (error) {
        log.error('Error parsing CORS_METHODS', error.message);
    }
}

const corsOptions = {
    origin: corsOrigin,
    methods: corsMethods,
};

// Create Express application
const app = express();

// Server configurations
const port = process.env.PORT || 4000;
const host = process.env.HOST || `http://localhost:${port}`;
const apiDocs = host + config.apiBasePath + '/docs';

// Define paths to the SSL key and certificate files
const keyPath = path.join(__dirname, 'ssl/key.pem');
const certPath = path.join(__dirname, 'ssl/cert.pem');

// Read SSL key and certificate files securely
const options = {
    key: fs.readFileSync(keyPath, 'utf-8'),
    cert: fs.readFileSync(certPath, 'utf-8'),
};

// Server both http and https
const server = httpolyglot.createServer(options, app);

// Create WebSocket server using Socket.io on top of HTTP server
const io = socketIO(server);

// Server config
function getServerConfig(tunnelHttps = false) {
    return {
        ice: config.iceServers,
        host: {
            password_enabled: config.hostPasswordEnabled,
            password: config.hostPassword,
        },
        api_key_secret: config.apiKeySecret,
        api_docs: apiDocs,
        embed: {
            allowedOrigins: embedAllowedOrigins.length ? embedAllowedOrigins : 'any',
            csp: embedCsp ? embedCsp.csp : 'not set (embedding allowed from any origin)',
        },
        running_at: tunnelHttps ? tunnelHttps : host,
        environment: process.env.NODE_ENV || 'development',
        appVersion: packageJson.version,
        nodeVersion: process.versions.node,
    };
}

// Handle Ngrok
async function ngrokStart() {
    try {
        await ngrok.authtoken(ngrokAuthToken);
        const listener = await ngrok.forward({ addr: port });
        const tunnelUrl = listener.url();
        log.info('Server config', getServerConfig(tunnelUrl));
    } catch (err) {
        log.warn('Ngrok Start error', err);
        await ngrok.kill();
        process.exit(1);
    }
}

// Trust proxy configuration (required for correct client IP detection and
// rate limiting when running behind a reverse proxy such as Nginx/Apache).
// Set TRUST_PROXY to a number of hops (e.g. 1) or a boolean. Defaults to off
// so req.ip reflects the direct connection and cannot be spoofed via headers.
if (process.env.TRUST_PROXY && process.env.TRUST_PROXY !== 'false') {
    const trustProxyValue = /^\d+$/.test(process.env.TRUST_PROXY)
        ? parseInt(process.env.TRUST_PROXY, 10)
        : process.env.TRUST_PROXY;
    app.set('trust proxy', trustProxyValue);
    log.info('Trust proxy', { value: trustProxyValue });
}

// Global rate limiter to mitigate abuse/brute-force against HTTP endpoints.
const apiRateLimiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
    handler: (req, res, next, options) => {
        log.warn('Rate limit exceeded', { ip: req.ip, path: req.originalUrl });
        res.status(options.statusCode).json(options.message);
    },
});

// Configure Express middleware BEFORE starting the server
app.use(cors(corsOptions)); // Handle cors options
app.use(helmet.noSniff()); // Enable content type sniffing prevention
app.use(applyEmbedHeaders); // Apply iframe embedding restrictions (CSP frame-ancestors / X-Frame-Options)
app.use(express.static(PUBLIC_DIR)); // Serve static files from the 'public' directory
app.use(express.json()); // Api parse body data as json
if (config.rateLimitEnabled) {
    app.use(apiRateLimiter); // Throttle requests per IP to prevent abuse
}
app.use(config.apiBasePath + '/docs', swaggerUi.serve, swaggerUi.setup(config.swaggerDocument)); // api docs

// Logs requests
app.use((req, res, next) => {
    log.debug('New request', {
        //headers: req.headers,
        body: req.body,
        method: req.method,
        path: req.originalUrl,
    });
    next();
});

// Set up route to serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(HOME);
});

// Serve the privacy policy page
app.get('/privacy', (req, res) => {
    res.sendFile(PRIVACY);
});

// Get Random Background Images
app.get('/randomImage', async (req, res) => {
    if (config.randomImageUrl === '') return; // Keep client default bg image

    try {
        const response = await axios.get(config.randomImageUrl);
        const data = response.data;
        res.send(data);
    } catch (error) {
        log.error('Error fetching image', error.message);
    }
});

// List available locales (derived from app/locales/*.json)
app.get('/locales', (req, res) => {
    const locales = getAvailableLocales();
    res.json({ locales: locales.length > 0 ? locales : ['en'] });
});

// Get translations for a specific language
app.get('/translations/:locale', (req, res) => {
    try {
        const locale = String(req.params.locale || 'en').toLowerCase();
        const validLocales = getAvailableLocales();

        if (validLocales.length > 0 && !validLocales.includes(locale)) {
            return res.status(400).json({ error: 'Invalid locale' });
        }

        const translationPath = path.join(LOCALES_DIR, `${locale}.json`);
        if (!fs.existsSync(translationPath)) {
            return res.status(400).json({ error: 'Invalid locale' });
        }
        const translations = JSON.parse(fs.readFileSync(translationPath, 'utf8'));

        res.json({
            locale: locale,
            translations: translations,
        });
    } catch (error) {
        log.error('Error fetching translations', error.message);
        res.status(500).json({ error: 'Error loading translations' });
    }
});

// Direct Join room
app.get('/join/', (req, res) => {
    if (Object.keys(req.query).length > 0) {
        log.debug('Request query', req.query);

        const { user, call, password } = req.query;
        // http://localhost:8000/join?user=user1
        // http://localhost:8000/join?user=user2&call=user1
        // http://localhost:8000/join?user=user1&password=123456789
        // http://localhost:8000/join?user=user2&call=user1&password=123456789

        if (config.hostPasswordEnabled && password !== config.hostPassword) {
            return unauthorized(res);
        }

        const isValidUser = isValidUsername(user);
        log.debug('isValidUser', { user: user, valid: isValidUser });
        if (!isValidUser) {
            return unauthorized(res);
        }

        const isValidCall = call ? isValidUsername(call) : true;
        log.debug('isValidCall', { call: call, valid: isValidCall });
        if (call && !isValidCall) {
            return unauthorized(res);
        }

        if (user || (user && call)) {
            return res.sendFile(HOME);
        }
        return notFound(res);
    }
    return notFound(res);
});

app.get(`${config.apiBasePath}/connected`, (req, res) => {
    // Check if the user is authorized for this API call
    if (!isAuthorized(req)) {
        log.debug('Unauthorized API call: Get Connected', {
            headers: req.headers,
            body: req.body,
        });
        return res.status(403).json({ error: 'Unauthorized!' });
    }

    //log.debug(req.query);
    const { user } = req.query;
    if (!user) {
        return res.status(400).json({ error: 'User not provided in request query' });
    }

    // Room scoping: default to the public room so the generated call links are
    // always valid (caller and callee must be in the same room). Target a
    // custom room with ?room=Name.
    const room = sanitizeRoom(req.query.room);
    const roomParam = `&room=${encodeURIComponent(room)}`;

    // Construct the base URL (simplified)
    const baseUrl = `${req.protocol}://${req.get('Host')}`;

    // Generate the password part dynamically based on hostPasswordEnabled
    const password = config.hostPasswordEnabled ? `&password=${config.hostPassword}` : '';

    // Retrieve the list of connected users in the target room
    const users = getConnectedUsers(room);
    if (!users || typeof users.values !== 'function') {
        return res.status(500).json({ error: 'Unable to retrieve connected users' });
    }

    // Generate a list of user-to-call links for the provided user
    const connected = Array.from(users.values()).reduce((acc, connectedUser) => {
        if (user !== connectedUser) {
            acc.push(`${baseUrl}/join?user=${user}&call=${connectedUser}${roomParam}${password}`);
        }
        return acc;
    }, []);

    // Return the list of connected users that the provided user can call
    return res.json({ connected });
});

// Axios API requests
app.get(`${config.apiBasePath}/users`, (req, res) => {
    // check if user is authorized for the API call
    if (!isAuthorized(req)) {
        log.debug('Unauthorized API call: Get Users', {
            headers: req.headers,
            body: req.body,
        });
        return res.status(403).json({ error: 'Unauthorized!' });
    }
    // Retrieve the list of connected users (optionally scoped to a room)
    const users = getConnectedUsers(req.query.room ? sanitizeRoom(req.query.room) : undefined);
    return res.json({ users });
});

// Get VAPID public key for push subscription
app.get(`${config.apiBasePath}/vapidPublicKey`, (req, res) => {
    if (!config.pushEnabled) {
        return res.json({ enabled: false });
    }
    return res.json({ enabled: true, vapidPublicKey: config.pushVapidPublicKey });
});

// Handle push subscription update via REST (for service worker pushsubscriptionchange)
app.post(`${config.apiBasePath}/pushSubscription`, express.json(), (req, res) => {
    if (!config.pushEnabled) {
        return res.status(400).json({ error: 'Push notifications not enabled' });
    }
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Invalid subscription' });
    }
    // We can't reliably map this to a username from REST alone,
    // but we store it for resubscription change events
    log.debug('Push subscription updated via REST');
    return res.json({ success: true });
});

// Check if Host password required
app.get('/api/hostPassword', (req, res) => {
    const isPasswordRequired = config.hostPasswordEnabled;
    res.json({ isPasswordRequired });
});

// Check if Host password valid
app.post('/api/hostPasswordValidate', (req, res) => {
    const { password } = req.body;
    const success = password === config.hostPassword;
    res.json({ success: success });
});

// Sentry error handler (must be registered before other error handlers)
if (sentryEnabled && sentryDsn && sentryDsn !== '') {
    Sentry.setupExpressErrorHandler(app);
}

// Page not found
app.use((req, res) => {
    return notFound(res);
});

// Page not found
function notFound(res) {
    res.json({ data: '404 not found' });
}

// Unauthorized
function unauthorized(res) {
    res.json({ data: '401 Unauthorized' });
}

// Utility function to check API key authorization
const isAuthorized = (req) => {
    const { authorization } = req.headers;
    return authorization === config.apiKeySecret;
};

// Start the server and listen on the specified port
server.listen(port, () => {
    if (ngrokEnabled && ngrokAuthToken) {
        ngrokStart();
    } else {
        log.info('Server', getServerConfig());
    }
});

// Handle client errors (malformed/incomplete HTTP requests) gracefully
server.on('clientError', (err, socket) => {
    const msg =
        err.code === 'HPE_HEADER_OVERFLOW' || err.message === 'Parse Error'
            ? 'Client HTTP parse error'
            : 'Client connection error';
    log.warn(msg, { error: err.message, code: err.code });
    if (socket && !socket.destroyed) {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    }
});

// Enforce host password at the Socket.IO handshake. This is the single
// source of truth for socket-level authentication and runs before any event
// handler, so it cannot be bypassed by skipping the HTTP /join page and
// connecting the WebSocket transport directly.
io.use((socket, next) => {
    if (!config.hostPasswordEnabled) {
        socket.data.authorized = true;
        return next();
    }
    const auth = socket.handshake.auth || {};
    const provided = typeof auth.password === 'string' ? auth.password : '';
    if (provided && provided === config.hostPassword) {
        socket.data.authorized = true;
        return next();
    }
    log.warn('Socket.IO unauthorized handshake rejected', {
        id: socket.id,
        address: socket.handshake.address,
    });
    const err = new Error('Unauthorized');
    err.data = { code: 'UNAUTHORIZED' };
    return next(err);
});

// Limit the number of concurrent Socket.IO connections per client IP to
// mitigate connection-flooding abuse. Runs after the password check so only
// authorized handshakes are counted; the counter is released on 'disconnect'.
// Passing this middleware guarantees a matching 'connection'/'disconnect'
// pair, so the per-IP counter cannot leak.
io.use((socket, next) => {
    const ip = getSocketIp(socket);
    const current = socketConnectionsPerIp.get(ip) || 0;
    if (config.socketMaxConnectionsPerIp > 0 && current >= config.socketMaxConnectionsPerIp) {
        log.warn('Socket.IO connection limit exceeded', { ip, current });
        const err = new Error('Too many connections');
        err.data = { code: 'TOO_MANY_CONNECTIONS' };
        return next(err);
    }
    socketConnectionsPerIp.set(ip, current + 1);
    socket.data.clientIp = ip;
    return next();
});

// Handle WebSocket connections
io.on('connection', handleConnection);

// Function to handle individual WebSocket connections
function handleConnection(socket) {
    log.debug('User connected:', socket.id);

    // Per-socket sliding-window counter to throttle inbound message events and
    // mitigate event-flooding abuse.
    let msgWindowStart = Date.now();
    let msgCount = 0;

    // Send a ping message to the newly connected client
    sendPing(socket);

    // Set up event listeners for incoming messages and disconnect
    socket.on('message', handleMessage);
    socket.on('disconnect', handleClose);

    // Returns true if the socket has exceeded its allowed message rate.
    function isRateLimited() {
        if (!config.rateLimitEnabled || config.socketRateLimitMax <= 0) return false;
        const now = Date.now();
        if (now - msgWindowStart >= config.socketRateLimitWindowMs) {
            msgWindowStart = now;
            msgCount = 0;
        }
        msgCount++;
        return msgCount > config.socketRateLimitMax;
    }

    // Function to handle incoming messages
    function handleMessage(data) {
        if (!data || typeof data !== 'object') return;

        if (isRateLimited()) {
            log.warn('Socket message rate limit exceeded', {
                id: socket.id,
                ip: socket.data.clientIp,
                user: socket.username,
            });
            sendError(socket, 'Rate limit exceeded. Please slow down.');
            return;
        }

        const { type } = data;

        log.debug('Received message', type);

        switch (type) {
            case 'signIn':
                handleSignIn(data);
                break;
            case 'offerAccept':
            case 'offerBusy':
            case 'offerDecline':
            case 'offerCreate':
                handleOffer(data);
                break;
            case 'offer':
            case 'answer':
            case 'candidate':
            case 'leave':
            case 'remoteAudio':
            case 'remoteVideo':
                handleSignalingMessage(data);
                break;
            case 'mediaStatus':
                handleMediaStatus(data);
                break;
            case 'chat':
                data.from = socket.username || 'Anonymous';
                handleChatMessage(data);
                log.debug('Chat message:', data);
                break;
            case 'privateChat':
                data.from = socket.username || 'Anonymous';
                handlePrivateChatMessage(data);
                break;
            case 'pushSubscription':
                handlePushSubscription(data);
                break;
            case 'pushUnsubscribe':
                handlePushUnsubscribe(data);
                break;
            case 'testPush':
                handleTestPush();
                break;
            case 'pong':
                log.debug('Client response:', data.message);
                break;
            default:
                sendError(socket, `Unknown command: ${type}`);
                break;
        }
    }

    // Send a ping message to the newly connected client.
    // NOTE: iceServers (which may include TURN credentials) are intentionally
    // NOT sent here; they are delivered only after a successful sign-in to
    // prevent leaking TURN credentials to unauthenticated clients.
    function sendPing(socket) {
        sendMsgTo(socket, {
            type: 'ping',
            message: 'Hello Client!',
            pushEnabled: config.pushEnabled,
            ringTimeout: config.ringTimeout,
        });
    }

    // Function to handle push subscription registration
    function handlePushSubscription(data) {
        const { subscription } = data;
        const username = socket.username;
        const key = roomKey(socket.room, username);

        if (!config.pushEnabled || !username || !subscription || !subscription.endpoint) {
            return;
        }

        // Store subscription (support multiple devices per user)
        const existing = pushSubscriptions.get(key) || [];
        // Replace if same endpoint exists, otherwise add
        const idx = existing.findIndex((s) => s.endpoint === subscription.endpoint);
        if (idx >= 0) {
            existing[idx] = subscription;
        } else {
            existing.push(subscription);
        }
        pushSubscriptions.set(key, existing);
        log.debug('Push subscription stored for', username, { devices: existing.length });
    }

    // Function to handle push unsubscribe
    function handlePushUnsubscribe(data) {
        const { endpoint } = data;
        const username = socket.username;
        const key = roomKey(socket.room, username);

        if (!username || !endpoint) return;

        const existing = pushSubscriptions.get(key) || [];
        const filtered = existing.filter((s) => s.endpoint !== endpoint);
        if (filtered.length > 0) {
            pushSubscriptions.set(key, filtered);
        } else {
            pushSubscriptions.delete(key);
        }
        log.debug('Push subscription removed for', username, { remaining: filtered.length });
    }

    // Function to handle test push notification
    async function handleTestPush() {
        const username = socket.username;
        if (!config.pushEnabled || !username) return;

        const subscriptions = pushSubscriptions.get(roomKey(socket.room, username));
        if (!subscriptions || subscriptions.length === 0) {
            log.debug('No push subscriptions for test push', username);
            return;
        }

        const payload = JSON.stringify({
            type: 'testPush',
            title: 'Call-me',
            body: 'Push notifications are working!',
        });

        for (const sub of subscriptions) {
            try {
                await webpush.sendNotification(sub, payload);
                log.debug('Test push sent to', username);
            } catch (err) {
                log.warn('Test push failed for', username, { statusCode: err.statusCode, message: err.message });
            }
        }
    }

    // Function to handle user sign-in request
    function handleSignIn(data) {
        const { name } = data;
        const room = sanitizeRoom(data.room);

        const isValidName = isValidUsername(name);
        log.debug('isValidName', { username: name, room, valid: isValidName });
        if (!isValidName) {
            sendMsgTo(socket, {
                type: 'signIn',
                success: false,
                message:
                    'Invalid username.<br/> Allowed letters, numbers, underscores, periods, hyphens, and @. Length: 3-36 characters.',
            });
            return;
        }

        const key = roomKey(room, name);

        if (!users.has(key)) {
            users.set(key, socket);
            socket.username = name;
            socket.room = room;
            socket.join(ioRoom(room));

            // Initialize user media status (default: both enabled, no screen sharing)
            userMediaStatus.set(key, {
                video: true,
                audio: true,
                screenSharing: false,
            });

            log.debug('User signed in:', { name, room });
            // Deliver iceServers (including any TURN credentials) only after
            // successful authentication, not on the anonymous ping.
            sendMsgTo(socket, { type: 'signIn', success: true, iceServers: config.iceServers, room });
            broadcastConnectedUsers(room);
        } else {
            sendMsgTo(socket, { type: 'signIn', success: false, message: 'Username already in use' });
        }
    }

    // Function to handle offer request
    function handleOffer(data) {
        log.debug('handleOffer', data);

        const { from, to, name, type } = data;
        const room = socket.room;
        const toName = type === 'offerAccept' ? to : from;
        const recipientSocket = users.get(roomKey(room, toName));

        log.debug(`Handling offer for ${toName}`, { room });

        switch (type) {
            case 'offerAccept':
            case 'offerCreate':
                if (recipientSocket) {
                    // Include caller's media status when sending offer
                    const callerMediaStatus = userMediaStatus.get(roomKey(room, socket.username));
                    const offerData = {
                        ...data,
                        callerMediaStatus: callerMediaStatus,
                    };
                    sendMsgTo(recipientSocket, offerData);
                } else {
                    // User is offline — try push notification
                    if (type === 'offerAccept' && config.pushEnabled) {
                        sendPushNotification(room, toName, socket.username).then((sent) => {
                            if (sent) {
                                sendMsgTo(socket, { type: 'pushSent', username: toName });
                            } else {
                                sendMsgTo(socket, { type: 'notfound', username: toName });
                            }
                        });
                    } else {
                        log.warn(`Recipient (${toName}) not found`);
                        sendMsgTo(socket, { type: 'notfound', username: toName });
                    }
                }
                break;
            case 'offerDecline':
                log.warn(`User ${name} declined your call`);
                if (recipientSocket) {
                    sendMsgTo(recipientSocket, { type: 'offerDecline', from: name });
                }
                break;
            case 'offerBusy':
                log.warn(`User ${name} busy in another call`);
                if (recipientSocket) {
                    sendMsgTo(recipientSocket, { type: 'offerBusy', from: name });
                }
                break;
            default:
                log.warn(`Unknown offer type: ${type}`);
                break;
        }
    }

    // Function to handle media status updates
    function handleMediaStatus(data) {
        const { video, audio, screenSharing } = data;
        const username = socket.username;
        const room = socket.room;
        const key = roomKey(room, username);

        if (username && userMediaStatus.has(key)) {
            const currentStatus = userMediaStatus.get(key);
            const newStatus = {
                video: video !== undefined ? video : currentStatus.video,
                audio: audio !== undefined ? audio : currentStatus.audio,
                screenSharing: screenSharing !== undefined ? screenSharing : currentStatus.screenSharing,
            };

            userMediaStatus.set(key, newStatus);
            log.debug('Updated media status for', username, newStatus);

            // Broadcast screen sharing status change to other connected users if it changed
            if (screenSharing !== undefined && screenSharing !== currentStatus.screenSharing) {
                broadcastScreenSharingStatus(username, screenSharing);
            }
        }
    }

    // Function to broadcast screen sharing status to connected users in the same room
    function broadcastScreenSharingStatus(username, isScreenSharing) {
        const message = {
            type: 'remoteScreenShare',
            from: username,
            screenSharing: isScreenSharing,
        };

        log.debug('Broadcasting screen sharing status:', message);

        // Send to all other users in the same room (excluding the sender)
        socket.to(ioRoom(socket.room)).emit('message', message);
    }

    // Function to handle signaling messages (offer, answer, candidate, leave)
    function handleSignalingMessage(data) {
        const { type, name } = data;
        const recipientSocket = users.get(roomKey(socket.room, name));

        switch (type) {
            case 'leave':
                if (recipientSocket !== undefined) {
                    log.debug('Leave room', socket.username);
                    sendMsgTo(recipientSocket, { type: 'leave', name: socket.username });
                }
                break;
            default:
                if (recipientSocket !== undefined) {
                    sendMsgTo(recipientSocket, { ...data, name: socket.username });
                }
                break;
        }
    }

    // Function to handle chat messages
    function handleChatMessage(data) {
        const { text, from } = data;
        log.debug('Chat message from', from, ':', text);

        // Broadcast the chat message to other clients in the same room
        socket.to(ioRoom(socket.room)).emit('message', {
            type: 'chat',
            from: from || 'Anonymous',
            text: text,
            timestamp: Date.now(),
        });
    }

    // Function to handle private (1-to-1) chat messages
    function handlePrivateChatMessage(data) {
        const { to, from } = data;
        let { text } = data;

        // Validate recipient and message
        if (typeof to !== 'string' || typeof text !== 'string') return;
        text = text.trim();
        if (text.length === 0) return;
        // Limit message length to prevent abuse
        if (text.length > 5000) text = text.substring(0, 5000);

        const recipientSocket = users.get(roomKey(socket.room, to));

        if (!recipientSocket) {
            // Recipient is offline — notify the sender
            sendMsgTo(socket, { type: 'privateChatFailed', to });
            log.debug('Private chat recipient offline:', to);
            return;
        }

        log.debug('Private chat from', from, 'to', to);

        // Deliver only to the intended recipient
        sendMsgTo(recipientSocket, {
            type: 'privateChat',
            from: from || 'Anonymous',
            to: to,
            text: text,
            timestamp: Date.now(),
        });
    }

    // Function to handle the closing of a connection
    function handleClose() {
        // Release this socket's slot in the per-IP connection counter.
        const ip = socket.data.clientIp;
        if (ip) {
            const current = socketConnectionsPerIp.get(ip) || 0;
            if (current <= 1) {
                socketConnectionsPerIp.delete(ip);
            } else {
                socketConnectionsPerIp.set(ip, current - 1);
            }
        }

        const name = socket.username;
        const room = socket.room;
        if (name) {
            log.debug('User disconnected:', { name, room });
            const key = roomKey(room, name);
            users.delete(key);
            userMediaStatus.delete(key); // Clean up media status
            broadcastConnectedUsers(room);
        }
    }
}

// Allow letters, numbers, underscores, periods, hyphens, and @. Length: 3-36 characters.
// NOTE: the hyphen is intentionally placed at the end of the character class so it is
// treated literally. Writing it as ".-@" would form a range (0x2E–0x40) that would wrongly
// allow characters such as < > : ; / = ? and open an HTML-injection vector.
function isValidUsername(username) {
    const usernamePattern = /^[a-zA-Z0-9_.@-]{3,36}$/;
    return usernamePattern.test(username);
}

// Send push notification to an offline user
async function sendPushNotification(room, targetUsername, callerUsername) {
    const key = roomKey(room, targetUsername);
    const subscriptions = pushSubscriptions.get(key);
    if (!subscriptions || subscriptions.length === 0) {
        log.debug('No push subscription found for', targetUsername);
        return false;
    }

    const payload = JSON.stringify({
        type: 'incomingCall',
        title: 'Call-me',
        body: `${callerUsername} is calling you`,
        caller: callerUsername,
        url: `/join?user=${encodeURIComponent(targetUsername)}&call=${encodeURIComponent(callerUsername)}&room=${encodeURIComponent(room)}`,
    });

    let anySent = false;
    const invalidIndices = [];

    for (let i = 0; i < subscriptions.length; i++) {
        try {
            await webpush.sendNotification(subscriptions[i], payload);
            anySent = true;
            log.debug('Push notification sent to', targetUsername, { device: i + 1 });
        } catch (err) {
            log.warn('Push notification failed for', targetUsername, {
                device: i + 1,
                statusCode: err.statusCode,
                message: err.message,
            });
            // Remove expired/invalid subscriptions (410 Gone, 404 Not Found)
            if (err.statusCode === 410 || err.statusCode === 404) {
                invalidIndices.push(i);
            }
        }
    }

    // Clean up invalid subscriptions
    if (invalidIndices.length > 0) {
        const filtered = subscriptions.filter((_, idx) => !invalidIndices.includes(idx));
        if (filtered.length > 0) {
            pushSubscriptions.set(key, filtered);
        } else {
            pushSubscriptions.delete(key);
        }
    }

    return anySent;
}

// Sanitize a room name (fallback to default room when empty/invalid).
// Strips control characters (including the U+001F delimiter used by roomKey to
// prevent map-key injection/collision) and HTML/JS-significant characters as
// defense-in-depth against XSS, then trims and caps the length.
function sanitizeRoom(room) {
    if (typeof room !== 'string') return DEFAULT_ROOM;
    const cleaned = room
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001F\u007F]/g, '') // control chars (incl. the roomKey delimiter)
        .replace(/[<>"'`&]/g, '') // HTML/JS-significant chars
        .trim();
    if (!cleaned) return DEFAULT_ROOM;
    return cleaned.slice(0, 64);
}

// Composite key used for per-room user/media/push maps
function roomKey(room, name) {
    return `${room}\u001f${name}`;
}

// Socket.IO room name used for room-scoped broadcasts
function ioRoom(room) {
    return `room:${room}`;
}

// Resolve the client IP for a Socket.IO connection. When running behind a
// trusted reverse proxy (TRUST_PROXY set), the left-most X-Forwarded-For entry
// is used; otherwise the direct handshake address is used (not spoofable).
function getSocketIp(socket) {
    if (process.env.TRUST_PROXY && process.env.TRUST_PROXY !== 'false') {
        const xff = socket.handshake.headers['x-forwarded-for'];
        if (typeof xff === 'string' && xff.length > 0) {
            return xff.split(',')[0].trim();
        }
    }
    return socket.handshake.address;
}

// Function to get all connected users, optionally scoped to a single room
function getConnectedUsers(room) {
    const list = [];
    users.forEach((sock) => {
        if (room === undefined || sock.room === room) {
            list.push(sock.username);
        }
    });
    return list;
}

// Function to broadcast the connected users of a given room to that room only
function broadcastConnectedUsers(room) {
    const connectedUsers = getConnectedUsers(room);
    log.debug('Connected Users', { room, connectedUsers });
    io.to(ioRoom(room)).emit('message', { type: 'users', users: connectedUsers });
}

// Function to broadcast a message to all connected clients
function broadcastMsg(message) {
    log.debug('Broadcast message:', message);
    io.emit('message', message);
}

// Function to broadcast a message to all connected clients except the sender
function broadcastMsgExpectSender(socket, message) {
    log.debug('Broadcast message:', message);
    socket.broadcast.emit('message', message);
}

// Function to send a message to a specific connection
function sendMsgTo(socket, message) {
    log.debug('Sending message:', message.type);
    socket.emit('message', message);
}

// Function to send an error message to a specific connection
function sendError(socket, message) {
    log.error('Error:', message);
    sendMsgTo(socket, { type: 'error', message: message });
}

// Random password generator
function generatePassword(length = 12) {
    const upperCase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowerCase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const allCharacters = upperCase + lowerCase + numbers;

    let password = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * allCharacters.length);
        password += allCharacters[randomIndex];
    }

    return password;
}
