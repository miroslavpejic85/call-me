'use strict';

// This user agent
const userAgent = navigator.userAgent;

// WebSocket connection to the signaling server
const socket = io();

// WebRTC configuration
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// DOM elements
const sessionTime = document.querySelector('#sessionTime');
const githubDiv = document.querySelector('#githubDiv');
const signInPage = document.querySelector('#signInPage');
const usernameIn = document.querySelector('#usernameIn');
const signInBtn = document.querySelector('#signInBtn');
const roomPage = document.querySelector('#roomPage');
const callUsernameIn = document.querySelector('#callUsernameIn');
const callBtn = document.querySelector('#callBtn');
const hideBtn = document.querySelector('#hideBtn');
const hangUpBtn = document.querySelector('#hangUpBtn');
const localVideoContainer = document.querySelector('#localVideoContainer');
const localVideo = document.querySelector('#localVideo');
const localUsername = document.querySelector('#localUsername');
const remoteVideo = document.querySelector('#remoteVideo');

// User and connection information
let userName;
let connectedUser;
let thisConnection;
let stream;

// On html page loaded...
document.addEventListener('DOMContentLoaded', function () {
    handleToolTip();
    handleLocalStorage();
    handleDirectJoin();
});

// Initialize tooltips
function handleToolTip() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-toggle="tooltip"]'));
    const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// Handle localStorage data
function handleLocalStorage() {
    usernameIn.value = localStorage.callMeUsername ? localStorage.callMeUsername : '';
    callUsernameIn.value = localStorage.callMeUsernameToCall ? localStorage.callMeUsernameToCall : '';
}

// Handle Room direct join
function handleDirectJoin() {
    const usp = new URLSearchParams(window.location.search);
    const user = usp.get('user');
    const call = usp.get('call');

    console.log('Direct Join detected', { user, call });

    if (user) {
        // SignIn
        usernameIn.value = user;
        handleSignInClick();

        if (call) {
            // Call user if call is provided
            callUsernameIn.value = call;
            handleCallClick();
        }
    }
}

// Session Time
function startSessionTime() {
    console.log('Start session time');
    sessionTime.style.display = 'inline-flex';
    let sessionElapsedTime = 0;
    setInterval(function printTime() {
        sessionElapsedTime++;
        sessionTime.innerText = secondsToHms(sessionElapsedTime);
    }, 1000);
}

// Session Time in h/m/s
function secondsToHms(d) {
    d = Number(d);
    let h = Math.floor(d / 3600);
    let m = Math.floor((d % 3600) / 60);
    let s = Math.floor((d % 3600) % 60);
    let hDisplay = h > 0 ? h + 'h' : '';
    let mDisplay = m > 0 ? m + 'm' : '';
    let sDisplay = s > 0 ? s + 's' : '';
    return hDisplay + ' ' + mDisplay + ' ' + sDisplay;
}

// WebSocket event listeners
socket.on('connect', handleSocketConnect);
socket.on('message', handleMessage);
socket.on('error', handleSocketError);

// Handle WebSocket connection establishment
function handleSocketConnect() {
    console.log('Connected to the signaling server');
}

// Handle WebSocket errors
function handleSocketError(err) {
    handleError('Socket error', err.message);
}

// Handle incoming messages based on type
function handleMessage(data) {
    const { type } = data;

    console.log('Got message', type);

    switch (type) {
        case 'ping':
            handlePing(data);
            break;
        case 'signIn':
            handleSignIn(data);
            break;
        case 'notfound':
            handleNotFound(data);
            break;
        case 'offerAccept':
            offerAccept(data);
            break;
        case 'offerCreate':
            offerCreate();
            break;
        case 'offer':
            handleOffer(data);
            break;
        case 'answer':
            handleAnswer(data);
            break;
        case 'candidate':
            handleCandidate(data);
            break;
        case 'leave':
            handleLeave();
            break;
        case 'error':
            handleError(data.message, data.message);
            break;
        default:
            break;
    }
}

// Event listeners
signInBtn.addEventListener('click', handleSignInClick);
callBtn.addEventListener('click', handleCallClick);
hideBtn.addEventListener('click', toggleLocalVideo);
hangUpBtn.addEventListener('click', handleHangUpClick);
localVideoContainer.addEventListener('click', toggleFullScreen);
remoteVideo.addEventListener('click', toggleFullScreen);

// Handle sign-in button click
function handleSignInClick() {
    userName = usernameIn.value;
    if (userName.length > 0) {
        sendMsg({
            type: 'signIn',
            name: userName,
        });
        localStorage.callMeUsername = userName;
    }
}

// Handle call button click
function handleCallClick() {
    const callToUsername = callUsernameIn.value;
    if (callToUsername.length > 0) {
        if (callToUsername === userName) {
            callUsernameIn.value = '';
            handleError('You cannot call yourself.');
            return;
        }
        connectedUser = callToUsername;
        sendMsg({
            type: 'offerAccept',
            from: userName,
            to: callToUsername,
        });
        localStorage.callMeUsernameToCall = callToUsername;
        popupMsg(`You are calling ${callToUsername}.<br/>Please wait for them to answer.`);
    } else {
        handleError('Please enter a username to call.');
    }
}

// Toggle local video visibility
function toggleLocalVideo() {
    localVideoContainer.classList.toggle('hide');
}

// Handle hang-up button click
function handleHangUpClick() {
    sendMsg({ type: 'leave', name: socket.recipient });
    handleLeave();
}

// Toggle video full screen mode
function toggleFullScreen(e) {
    if (!e.target.srcObject) return;
    document.fullscreenElement ? document.exitFullscreen() : e.target.requestFullscreen?.();
}

// Handle ping message from the server
function handlePing(data) {
    const { iceServers } = data;
    if (iceServers) {
        config.iceServers = iceServers;
    }
    sendMsg({
        type: 'pong',
        message: {
            client: 'Hello Server!',
            agent: userAgent,
        },
    });
}

// Handle user not found from the server
function handleNotFound(data) {
    const { username } = data;
    callUsernameIn.value = '';
    handleError(`Username ${username} not found!`);
}

// Handle sign-in response from the server
function handleSignIn(data) {
    const { success } = data;
    if (!success) {
        handleError('Username already in use.<br/>Please try a different one.');
        setTimeout(handleHangUpClick, 3000);
    } else {
        githubDiv.style.display = 'none';
        signInPage.style.display = 'none';
        roomPage.style.display = 'block';

        navigator.mediaDevices
            .getUserMedia({ video: true, audio: true })
            .then((myStream) => {
                stream = myStream;
                localVideo.srcObject = stream;
                localVideo.playsInline = true;
                localVideo.autoplay = true;
                localVideo.muted = true;
                localVideo.volume = 0;
                localVideo.controls = false;
                localUsername.innerText = userName;
                initializeConnection();
            })
            .catch((error) => {
                handleError('Failed to access camera and microphone.', error);
            });
    }
}

// Initialize WebRTC connection
function initializeConnection() {
    thisConnection = new RTCPeerConnection(config);

    stream.getTracks().forEach((track) => thisConnection.addTrack(track, stream));

    thisConnection.ontrack = (e) => {
        if (e.streams && e.streams[0]) {
            remoteVideo.srcObject = e.streams[0];
            remoteVideo.playsInline = true;
            remoteVideo.autoplay = true;
            remoteVideo.controls = false;
            //remoteVideo.click(); // The remote video start in full screen mode if supported

            startSessionTime();

            console.log('Remote stream set to video element');
        } else {
            handleError('No stream available in the ontrack event.');
        }
    };

    thisConnection.onicecandidate = (event) => {
        if (event.candidate) {
            sendMsg({
                type: 'candidate',
                candidate: event.candidate,
            });
        }
    };

    // For debugging purposes
    thisConnection.onconnectionstatechange = (event) => {
        console.log('Connection state change:', thisConnection.connectionState);
    };

    thisConnection.oniceconnectionstatechange = (event) => {
        console.log('ICE connection state change:', thisConnection.iceConnectionState);
    };
}

// Create and send an offer
function offerCreate() {
    if (!thisConnection) {
        initializeConnection();
    }
    thisConnection
        .createOffer()
        .then((offer) => {
            thisConnection.setLocalDescription(offer);
            sendMsg({
                type: 'offer',
                offer,
            });
            callUsernameIn.style.display = 'none';
        })
        .catch((error) => {
            handleError('Error when creating an offer.', error);
        });
}

// Accept incoming offer
function offerAccept(data) {
    sound('ring');
    Swal.fire({
        position: 'center',
        //icon: 'question',
        imageUrl: 'assets/ring.png',
        text: 'Do you want to accept call from ' + data.from + ' ?',
        showDenyButton: true,
        confirmButtonText: `Yes`,
        denyButtonText: `No`,
        timerProgressBar: true,
        timer: 10000,
        showClass: { popup: 'animate__animated animate__fadeInDown' },
        hideClass: { popup: 'animate__animated animate__fadeOutUp' },
    }).then((result) => {
        if (result.isConfirmed) {
            callUsernameIn.style.display = 'none';
            callBtn.style.display = 'none';
            data.type = 'offerCreate';
            socket.recipient = data.from;
        } else {
            data.type = 'offerDecline';
        }
        sendMsg({ ...data });
    });
}

// Handle incoming offer
function handleOffer(data) {
    const { offer, name } = data;
    connectedUser = name;
    initializeConnection();
    thisConnection.setRemoteDescription(new RTCSessionDescription(offer));
    thisConnection
        .createAnswer()
        .then((answer) => {
            thisConnection.setLocalDescription(answer);
            sendMsg({
                type: 'answer',
                answer,
            });
        })
        .catch((error) => {
            handleError('Error when creating an answer.', error);
        });
}

// Handle incoming answer
function handleAnswer(data) {
    const { answer } = data;
    thisConnection.setRemoteDescription(new RTCSessionDescription(answer)).catch((error) => {
        handleError('Error when set remote description.', error);
    });
}

// Handle incoming ICE candidate
function handleCandidate(data) {
    const { candidate } = data;
    callBtn.style.display = 'none';
    thisConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch((error) => {
        handleError('Error when add ice candidate.', error);
        callBtn.style.display = 'inline';
    });
}

// Play audio sound
async function sound(name) {
    const sound = './assets/' + name + '.wav';
    const audio = new Audio(sound);
    try {
        audio.volume = 0.5;
        await audio.play();
    } catch (err) {
        return false;
    }
}

// Handle leaving the room
function handleLeave() {
    // Stop local video tracks
    if (localVideo.srcObject != null) {
        localVideo.srcObject.getTracks().forEach((track) => track.stop());
        localVideo.srcObject = null;
    }
    // Stop remote video tracks
    if (remoteVideo.srcObject != null) {
        remoteVideo.srcObject.getTracks().forEach((track) => track.stop());
        remoteVideo.srcObject = null;
    }
    // Disconnect from server
    if (thisConnection) {
        thisConnection.close();
        thisConnection = null;
    }
    // GoTo homepage
    connectedUser = null;
    window.location.href = '/';
}

// Handle and display errors
function handleError(message, error = false, position = 'center', timer = 4000) {
    if (error) console.error(error);
    sound('notify');
    Swal.fire({
        position,
        icon: 'warning',
        html: message,
        timerProgressBar: true,
        timer,
        showClass: { popup: 'animate__animated animate__fadeInDown' },
        hideClass: { popup: 'animate__animated animate__fadeOutUp' },
    });
}

// Display Message to user
function popupMsg(message, position = 'top', timer = 4000) {
    Swal.fire({
        position,
        html: message,
        timerProgressBar: true,
        timer,
        showClass: { popup: 'animate__animated animate__fadeInDown' },
        hideClass: { popup: 'animate__animated animate__fadeOutUp' },
    });
}

// Send messages to the server
function sendMsg(message) {
    if (connectedUser) {
        message.name = connectedUser;
    }
    socket.emit('message', message);
}

// Clean up before window close or reload
window.onbeforeunload = () => {
    handleHangUpClick();
};
