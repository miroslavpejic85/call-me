'use strict';

// This user agent
const userAgent = navigator.userAgent;

// WebSocket connection to the signaling server
const socket = io();

// WebRTC configuration
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// DOM elements
const attribution = document.getElementById('attribution');
const randomImage = document.getElementById('randomImage');
const sessionTime = document.getElementById('sessionTime');
const githubDiv = document.getElementById('githubDiv');
const signInPage = document.getElementById('signInPage');
const usernameIn = document.getElementById('usernameIn');
const signInBtn = document.getElementById('signInBtn');
const roomPage = document.getElementById('roomPage');
const callUsernameIn = document.getElementById('callUsernameIn');
const callBtn = document.getElementById('callBtn');
const hideBtn = document.getElementById('hideBtn');
const hangUpBtn = document.getElementById('hangUpBtn');
const localVideoContainer = document.getElementById('localVideoContainer');
const localVideo = document.getElementById('localVideo');
const localUsername = document.getElementById('localUsername');
const remoteVideo = document.getElementById('remoteVideo');

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
    handleListeners();
    fetchRandomImage();
});

// Handle config
if (!app.showGithub) {
    githubDiv.style.display = 'none';
}

async function checkHostPassword(maxRetries = 3, attempts = 0) {
    try {
        // Fetch host configuration
        const { data: config } = await axios.get('/api/hostPassword');

        if (config.isPasswordRequired) {
            // Show prompt for the password
            const { value: password } = await Swal.fire({
                title: 'Host Protected',
                text: 'Please enter the host password:',
                input: 'password',
                inputPlaceholder: 'Enter your password',
                inputAttributes: {
                    autocapitalize: 'off',
                    autocorrect: 'off',
                },
                imageUrl: 'assets/locked.png',
                imageWidth: 150,
                imageHeight: 150,
                allowOutsideClick: false,
                allowEscapeKey: false,
                showDenyButton: true,
                confirmButtonText: 'Submit',
                denyButtonText: `Cancel`,
                preConfirm: (password) => {
                    if (!password) {
                        Swal.showValidationMessage('Password cannot be empty');
                    }
                    return password;
                },
            });

            // If the user cancels, exit
            if (!password) {
                return;
            }

            // Validate the password
            const { data: validationResult } = await axios.post('/api/hostPasswordValidate', { password });

            if (validationResult.success) {
                await Swal.fire({
                    icon: 'success',
                    title: 'Access Granted',
                    text: 'Password validated successfully!',
                    timer: 1500,
                    showConfirmButton: false,
                });
                signInPage.style.display = 'block';
            } else {
                attempts++;
                if (attempts < maxRetries) {
                    await Swal.fire({
                        icon: 'error',
                        title: 'Invalid Password',
                        text: `Please try again. (${attempts}/${maxRetries} attempts)`,
                    });
                    // Retry the process
                    checkHostPassword(maxRetries, attempts);
                } else {
                    await Swal.fire({
                        icon: 'warning',
                        title: 'Too Many Attempts',
                        text: 'You have exceeded the maximum number of attempts. Please try again later.',
                    });
                }
            }
        } else {
            // No password required
            signInPage.style.display = 'block';
        }
    } catch (error) {
        console.error('Error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'An error occurred while joining the host.',
        });
    }
}

// Get Random Images
async function fetchRandomImage() {
    if (sessionStorage.cachedImage) {
        // If there's cached data, use it
        randomImage.src = sessionStorage.cachedImage;
        console.log('Using cached image');
        return;
    }

    try {
        const response = await axios.get('/randomImage');
        const data = response.data;

        // Cache the image URL for subsequent calls
        sessionStorage.cachedImage = data.urls.regular;

        // Update the image source
        randomImage.src = sessionStorage.cachedImage;
        console.log('Fetched and cached image');

        // Create and display attribution
        const attributionText = `Photo by <a href="${data.user.links.html}?utm_source=call-me&utm_medium=referral" target="_blank">${data.user.name}</a> on <a href="https://unsplash.com/?utm_source=call-me&utm_medium=referral" target="_blank">Unsplash</a>`;

        // Assuming you have an element with id 'attribution' for the attribution text
        attribution.innerHTML = attributionText;
    } catch (error) {
        console.error('Error fetching image', error.message);
    }
}

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
    const password = usp.get('password');

    console.log('Direct Join detected', { user, call, password });

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

    if (!password) checkHostPassword();
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

// Handle Listeners
function handleListeners() {
    // Event listeners
    signInBtn.addEventListener('click', handleSignInClick);
    callBtn.addEventListener('click', handleCallClick);
    hideBtn.addEventListener('click', toggleLocalVideo);
    hangUpBtn.addEventListener('click', handleHangUpClick);
    localVideoContainer.addEventListener('click', toggleFullScreen);
    remoteVideo.addEventListener('click', toggleFullScreen);
    // Add keyUp listeners
    callUsernameIn.addEventListener('keyup', (e) => handleKeyUp(e, handleCallClick));
    usernameIn.addEventListener('keyup', (e) => handleKeyUp(e, handleSignInClick));
}

// Generic keyUp handler
function handleKeyUp(e, callback) {
    if (e.key === 'Enter') {
        e.preventDefault();
        callback();
    }
}

// Handle sign-in button click
function handleSignInClick() {
    userName = usernameIn.value.trim();
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
    const callToUsername = callUsernameIn.value.trim();
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
        attribution.style.display = 'none';
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
        imageUrl: 'assets/ring.png',
        imageWidth: 284,
        imageHeight: 120,
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
