'use strict';

// Import necessary modules
const dotenv = require('dotenv').config();
const express = require('express');
const fs = require('fs');
const http = require('http');
const https = require('https');
const socketIO = require('socket.io');
const path = require('path');
const yaml = require('js-yaml');
const swaggerUi = require('swagger-ui-express');
const packageJson = require('../package.json');

// Public directory location
const PUBLIC_DIR = path.join(__dirname, '../', 'public');

// Home page/client
const HOME = path.join(PUBLIC_DIR, '/index.html');

// Map to store connected users
const users = new Map();

// Configuration settings
const config = {
    iceServers: [],
    stunServerEnabled: process.env.STUN_SERVER_ENABLED === 'true',
    stunServerUrl: process.env.STUN_SERVER_URL,
    turnServerEnabled: process.env.TURN_SERVER_ENABLED === 'true',
    turnServerUrl: process.env.TURN_SERVER_URL,
    turnServerUsername: process.env.TURN_SERVER_USERNAME,
    turnServerCredential: process.env.TURN_SERVER_CREDENTIAL,
    apiKeySecret: process.env.API_KEY_SECRET,
    apiBasePath: '/api/v1',
    swaggerDocument: yaml.load(fs.readFileSync(path.join(__dirname, '/api/swagger.yaml'), 'utf8')),
};

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

// Create Express application
const app = express();

// Server configurations
const domain = process.env.DOMAIN || 'localhost';
const isHttps = process.env.SSL === 'true';
const port = process.env.PORT || 4000;
const host = `http${isHttps ? 's' : ''}://${domain}:${port}`;
const apiDocs = host + config.apiBasePath + '/docs';

// This server
let server;

// Load self-signed certificates if HTTPS is enabled
if (isHttps) {
    try {
        const options = {
            key: fs.readFileSync(path.join(__dirname, '/ssl/key.pem'), 'utf-8'),
            cert: fs.readFileSync(path.join(__dirname, '/ssl/cert.pem'), 'utf-8'),
        };
        // Create HTTPS server using Express
        server = https.createServer(options, app);
    } catch (err) {
        console.error('Error loading certificates:', err);
        process.exit(1); // Exit the process if certificates cannot be loaded
    }
} else {
    // Create HTTP server using Express
    server = http.createServer(app);
}

// Create WebSocket server using Socket.io on top of HTTP server
const io = socketIO(server);

// Start the server and listen on the specified port
server.listen(port, () => {
    console.log('Server', {
        running_at: host,
        ice: config.iceServers,
        api_key_secret: config.apiKeySecret,
        api_docs: apiDocs,
        version: packageJson.version,
    });
});

// Handle WebSocket connections
io.on('connection', handleConnection);

app.use(express.static(PUBLIC_DIR)); // Serve static files from the 'public' directory
app.use(express.json()); // Api parse body data as json
app.use(config.apiBasePath + '/docs', swaggerUi.serve, swaggerUi.setup(config.swaggerDocument)); // api docs

// Logs requests
app.use((req, res, next) => {
    console.log('New request', {
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

// Direct Join room
app.get('/join/', (req, res) => {
    if (Object.keys(req.query).length > 0) {
        console.log('Request query', req.query);
        // http://localhost:8000/join?user=user1
        // http://localhost:8000/join?user=user2&call=user1
        const { user, call } = req.query;
        if (user || (user && call)) {
            return res.sendFile(HOME);
        }
        return notFound(res);
    }
    return notFound(res);
});

// Axios API requests
app.get(`${config.apiBasePath}/users`, (req, res) => {
    // check if user is authorized for the API call
    const { authorization } = req.headers;
    console.log(authorization);
    if (authorization != config.apiKeySecret) {
        console.log('Unauthorized API call: Get Users', {
            headers: req.headers,
            body: req.body,
        });
        return res.status(403).json({ error: 'Unauthorized!' });
    }
    // Get connected users
    const users = getConnectedUsers();
    return res.json({ users });
});

// Page not found
app.get('*', (req, res) => {
    return notFound(res);
});

// Page not found
function notFound(res) {
    res.json({ data: '404 not found' });
}

// Function to handle individual WebSocket connections
function handleConnection(socket) {
    console.log('User connected:', socket.id);

    // Send a ping message to the newly connected client
    sendPing(socket);

    // Set up event listeners for incoming messages and disconnect
    socket.on('message', handleMessage);
    socket.on('disconnect', handleClose);

    // Function to handle incoming messages
    function handleMessage(data) {
        const { type } = data;

        console.log('Received message', type);

        switch (type) {
            case 'signIn':
                handleSignIn(data);
                break;
            case 'offerAccept':
            case 'offerDecline':
            case 'offerCreate':
                handleOffer(data);
                break;
            case 'offer':
            case 'answer':
            case 'candidate':
            case 'leave':
                handleSignalingMessage(data);
                break;
            case 'pong':
                console.log('Client response:', data.message);
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
        if (!users.has(name)) {
            users.set(name, socket);
            socket.username = name;
            console.log('User signed in:', name);
            sendMsgTo(socket, { type: 'signIn', success: true });
            console.log('Connected Users', getConnectedUsers());
        } else {
            sendMsgTo(socket, { type: 'signIn', success: false, message: 'Username already in use' });
        }
    }

    // Function to handle offer request
    function handleOffer(data) {
        console.log('handleOffer', data);

        const { from, to, name, type } = data;
        const toName = type === 'offerAccept' ? to : from;
        const recipientSocket = users.get(toName);

        console.log(`Handling offer for ${toName}`);

        switch (type) {
            case 'offerAccept':
            case 'offerCreate':
                if (recipientSocket) {
                    sendMsgTo(recipientSocket, data);
                } else {
                    console.warn(`Recipient (${toName}) not found`);
                    sendMsgTo(socket, { type: 'notfound', username: toName });
                }
                break;
            case 'offerDecline':
                console.warn(`User ${name} declined your call`);
                sendError(recipientSocket || socket, `User ${name} declined your call`);
                break;
            default:
                console.warn(`Unknown offer type: ${type}`);
                break;
        }
    }

    // Function to handle signaling messages (offer, answer, candidate, leave)
    function handleSignalingMessage(data) {
        const { type, name } = data;
        const recipientSocket = users.get(name);

        switch (type) {
            case 'leave':
                if (recipientSocket !== undefined) {
                    console.log('Leave room', socket.username);
                    sendMsgTo(recipientSocket, { type: 'leave' });
                }
                break;
            default:
                if (recipientSocket !== undefined) {
                    sendMsgTo(recipientSocket, { ...data, name: socket.username });
                }
                break;
        }
    }

    // Function to handle the closing of a connection
    function handleClose() {
        if (socket.username) {
            console.log('User disconnected:', socket.username);
            users.delete(socket.username);
            console.log('Connected Users', getConnectedUsers());
        }
    }
}

// Function to get all connected users
function getConnectedUsers() {
    return Array.from(users.keys());
}

// Function to broadcast a message to all connection
function broadcastMsg(socket, message) {
    console.log('Broadcast message:', message.type);
    socket.broadcast.emit('message', message);
}

// Function to send a message to a specific connection
function sendMsgTo(socket, message) {
    console.log('Sending message:', message.type);
    socket.emit('message', message);
}

// Function to send an error message to a specific connection
function sendError(socket, message) {
    console.error('Error:', message);
    sendMsgTo(socket, { type: 'error', message: message });
}
