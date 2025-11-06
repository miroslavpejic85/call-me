'use strict';

// Import necessary modules
const dotenv = require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const httpolyglot = require('httpolyglot');
const ngrok = require('@ngrok/ngrok');
const socketIO = require('socket.io');
const axios = require('axios');
const helmet = require('helmet');
const path = require('path');
const yaml = require('js-yaml');
const swaggerUi = require('swagger-ui-express');
const packageJson = require('../package.json');

// Logs
const logs = require('./logs');
const log = new logs('server');

// Public directory location
const PUBLIC_DIR = path.join(__dirname, '../', 'public');

// Home page/client
const HOME = path.join(PUBLIC_DIR, '/index.html');

// Map to store connected users
const users = new Map();

// Map to store user media status (video/audio enabled/disabled)
const userMediaStatus = new Map();

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
    randomImageUrl: process.env.RANDOM_IMAGE_URL || '',
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

// Start the server and listen on the specified port
server.listen(port, () => {
    if (ngrokEnabled && ngrokAuthToken) {
        ngrokStart();
    } else {
        log.info('Server', getServerConfig());
    }
});

// Handle WebSocket connections
io.on('connection', handleConnection);

app.use(cors(corsOptions)); // Handle cors options
app.use(helmet.noSniff()); // Enable content type sniffing prevention
app.use(express.static(PUBLIC_DIR)); // Serve static files from the 'public' directory
app.use(express.json()); // Api parse body data as json
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

        const isValidCall = isValidUsername(user);
        log.debug('isValidCall', { call: call, valid: isValidCall });
        if (!isValidCall) {
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

    // Construct the base URL (simplified)
    const baseUrl = `${req.protocol}://${req.get('Host')}`;

    // Generate the password part dynamically based on hostPasswordEnabled
    const password = config.hostPasswordEnabled ? `&password=${config.hostPassword}` : '';

    // Retrieve the list of connected users (ensure this returns an iterable like Map or Array)
    const users = getConnectedUsers();
    if (!users || typeof users.values !== 'function') {
        return res.status(500).json({ error: 'Unable to retrieve connected users' });
    }

    // Generate a list of user-to-call links for the provided user
    const connected = Array.from(users.values()).reduce((acc, connectedUser) => {
        if (user !== connectedUser) {
            acc.push(`${baseUrl}/join?user=${user}&call=${connectedUser}${password}`);
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
    // Retrieve the list of connected users
    const users = getConnectedUsers();
    return res.json({ users });
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

// Function to handle individual WebSocket connections
function handleConnection(socket) {
    log.debug('User connected:', socket.id);

    // Refresh connected users
    broadcastConnectedUsers();

    // Send a ping message to the newly connected client
    sendPing(socket);

    // Set up event listeners for incoming messages and disconnect
    socket.on('message', handleMessage);
    socket.on('disconnect', handleClose);

    // Function to handle incoming messages
    function handleMessage(data) {
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
            case 'pong':
                log.debug('Client response:', data.message);
                break;
            default:
                sendError(socket, `Unknown command: ${type}`);
                break;
        }
    }

    // Send a ping message to the newly connected client and iceServers for peer connection
    function sendPing(socket) {
        sendMsgTo(socket, {
            type: 'ping',
            message: 'Hello Client!',
            iceServers: config.iceServers,
        });
    }

    // Function to handle user sign-in request
    function handleSignIn(data) {
        const { name } = data;

        const isValidName = isValidUsername(name);
        log.debug('isValidName', { username: name, valid: isValidName });
        if (!isValidName) {
            sendMsgTo(socket, {
                type: 'signIn',
                success: false,
                message:
                    'Invalid username.<br/> Allowed letters, numbers, underscores, periods, hyphens, and @. Length: 3-36 characters.',
            });
            return;
        }

        if (!users.has(name)) {
            users.set(name, socket);
            socket.username = name;

            // Initialize user media status (default: both enabled, no screen sharing)
            userMediaStatus.set(name, {
                video: true,
                audio: true,
                screenSharing: false,
            });

            log.debug('User signed in:', name);
            sendMsgTo(socket, { type: 'signIn', success: true });
            broadcastConnectedUsers();
        } else {
            sendMsgTo(socket, { type: 'signIn', success: false, message: 'Username already in use' });
        }
    }

    // Function to handle offer request
    function handleOffer(data) {
        log.debug('handleOffer', data);

        const { from, to, name, type } = data;
        const toName = type === 'offerAccept' ? to : from;
        const recipientSocket = users.get(toName);

        log.debug(`Handling offer for ${toName}`);

        switch (type) {
            case 'offerAccept':
            case 'offerCreate':
                if (recipientSocket) {
                    // Include caller's media status when sending offer
                    const callerMediaStatus = userMediaStatus.get(socket.username);
                    const offerData = {
                        ...data,
                        callerMediaStatus: callerMediaStatus,
                    };
                    sendMsgTo(recipientSocket, offerData);
                } else {
                    log.warn(`Recipient (${toName}) not found`);
                    sendMsgTo(socket, { type: 'notfound', username: toName });
                }
                break;
            case 'offerDecline':
                log.warn(`User ${name} declined your call`);
                sendError(recipientSocket || socket, `User ${name} declined your call`);
                break;
            case 'offerBusy':
                log.warn(`User ${name} busy in another call`);
                sendError(recipientSocket || socket, `User ${name} busy in another call.`);
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

        if (username && userMediaStatus.has(username)) {
            const currentStatus = userMediaStatus.get(username);
            const newStatus = {
                video: video !== undefined ? video : currentStatus.video,
                audio: audio !== undefined ? audio : currentStatus.audio,
                screenSharing: screenSharing !== undefined ? screenSharing : currentStatus.screenSharing,
            };

            userMediaStatus.set(username, newStatus);
            log.debug('Updated media status for', username, newStatus);

            // Broadcast screen sharing status change to other connected users if it changed
            if (screenSharing !== undefined && screenSharing !== currentStatus.screenSharing) {
                broadcastScreenSharingStatus(username, screenSharing);
            }
        }
    }

    // Function to broadcast screen sharing status to connected users
    function broadcastScreenSharingStatus(username, isScreenSharing) {
        const message = {
            type: 'remoteScreenShare',
            from: username,
            screenSharing: isScreenSharing,
        };

        log.debug('Broadcasting screen sharing status:', message);

        // Send to all other connected users
        users.forEach((userSocket, userName) => {
            if (userName !== username) {
                sendMsgTo(userSocket, message);
            }
        });
    }

    // Function to handle signaling messages (offer, answer, candidate, leave)
    function handleSignalingMessage(data) {
        const { type, name } = data;
        const recipientSocket = users.get(name);

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

        // Broadcast the chat message to all connected clients
        broadcastMsgExpectSender(socket, {
            type: 'chat',
            from: from || 'Anonymous',
            text: text,
            timestamp: Date.now(),
        });
    }

    // Function to handle the closing of a connection
    function handleClose() {
        const name = socket.username;
        if (name) {
            log.debug('User disconnected:', name);
            users.delete(name);
            userMediaStatus.delete(name); // Clean up media status
            broadcastConnectedUsers();
        }
    }
}

// Allow letters, numbers, underscores, periods, hyphens, and @. Length: 3-36 characters
function isValidUsername(username) {
    const usernamePattern = /^[a-zA-Z0-9_.-@]{3,36}$/;
    return usernamePattern.test(username);
}

// Function to get all connected users
function getConnectedUsers() {
    return Array.from(users.keys());
}

// Function to broadcast all connected users
function broadcastConnectedUsers() {
    const connectedUsers = getConnectedUsers();
    log.debug('Connected Users', connectedUsers);
    broadcastMsg({ type: 'users', users: connectedUsers });
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
