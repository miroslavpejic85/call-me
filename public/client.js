'use strict';

// This user agent
const userAgent = navigator.userAgent;

// WebSocket connection to the signaling server
const socket = io();

// WebRTC configuration
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// DOM elements
const appTitle = document.getElementById('appTitle');
const appName = document.getElementById('appName');
const attribution = document.getElementById('attribution');
const randomImage = document.getElementById('randomImage');
const sessionTime = document.getElementById('sessionTime');
const githubDiv = document.getElementById('githubDiv');
const signInPage = document.getElementById('signInPage');
const usernameIn = document.getElementById('usernameIn');
const signInBtn = document.getElementById('signInBtn');
const roomPage = document.getElementById('roomPage');
const callUsernameSelect = document.getElementById('callUsernameSelect');
const hideBtn = document.getElementById('hideBtn');
const callBtn = document.getElementById('callBtn');
const swapCameraBtn = document.getElementById('swapCameraBtn');
const videoBtn = document.getElementById('videoBtn');
const audioBtn = document.getElementById('audioBtn');
const hangUpBtn = document.getElementById('hangUpBtn');
const localVideoContainer = document.getElementById('localVideoContainer');
const localVideo = document.getElementById('localVideo');
const localUsername = document.getElementById('localUsername');
const remoteVideo = document.getElementById('remoteVideo');

// User and connection information
let userInfo;
let userName;
let connectedUser;
let thisConnection;
let camera = 'user';
let stream;

// Variable to store the interval ID
let sessionTimerId = null;

// On html page loaded...
document.addEventListener('DOMContentLoaded', async function () {
    userInfo = getUserInfo(userAgent);
    handleToolTip();
    handleLocalStorage();
    handleDirectJoin();
    handleListeners();
    fetchRandomImage();
});

// Get user information from User-Agent string
function getUserInfo(userAgent) {
    const parser = new UAParser(userAgent);
    const { device, os, browser } = parser.getResult();

    // Determine device type and specific characteristics
    const deviceType = device.type || 'desktop';
    const isIPad = device.model?.toLowerCase() === 'ipad';
    const osName = os.name || 'Unknown OS';
    const osVersion = os.version || 'Unknown Version';
    const browserName = browser.name || 'Unknown Browse';
    const browserVersion = browser.version || 'Unknown Version';

    return {
        device: {
            isMobile: deviceType === 'mobile',
            isTablet: deviceType === 'tablet',
            isDesktop: deviceType === 'desktop',
            isIPad,
        },
        os: `${osName} ${osVersion}`,
        browser: `${browserName} ${browserVersion}`,
        userAgent,
    };
}

// Handle config
appTitle.innerText = app.title;
appName.innerText = app.name;

const elementsToHide = [
    { condition: !app.showGithub, element: githubDiv },
    { condition: !app.attribution, element: attribution },
];

elementsToHide.forEach(({ condition, element }) => {
    if (condition) elemDisplay(element, false);
});

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
                    position: 'top',
                    icon: 'success',
                    title: 'Access Granted',
                    text: 'Password validated successfully!',
                    timer: 1500,
                    showConfirmButton: false,
                });
                elemDisplay(signInPage, true);
            } else {
                attempts++;
                if (attempts < maxRetries) {
                    await Swal.fire({
                        position: 'top',
                        icon: 'error',
                        title: 'Invalid Password',
                        text: `Please try again. (${attempts}/${maxRetries} attempts)`,
                    });
                    // Retry the process
                    checkHostPassword(maxRetries, attempts);
                } else {
                    await Swal.fire({
                        position: 'top',
                        icon: 'warning',
                        title: 'Too Many Attempts',
                        text: 'You have exceeded the maximum number of attempts. Please try again later.',
                    });
                }
            }
        } else {
            // No password required
            elemDisplay(signInPage, true);
        }
    } catch (error) {
        console.error('Error:', error);
        Swal.fire({
            position: 'top',
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

// Initialize tooltips and handle hiding them when clicked
function handleToolTip() {
    if (userInfo.device.isMobile) return;

    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-toggle="tooltip"]'));
    const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    // Add click event listener to hide all tooltips
    tooltipTriggerList.forEach(function (tooltipTriggerEl) {
        tooltipTriggerEl.addEventListener('click', function () {
            tooltipList.forEach(function (tooltip) {
                tooltip.hide(); // Hide all tooltips
            });
        });
    });
}

// Handle localStorage data
function handleLocalStorage() {
    usernameIn.value = localStorage.callMeUsername ? localStorage.callMeUsername : '';
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
            setTimeout(() => {
                selectIndexByValue(call);
                handleCallClick();
            }, 3000);
        }
    }

    if (!password) checkHostPassword();
}

// Select index by passed value
function selectIndexByValue(value) {
    for (let i = 0; i < callUsernameSelect.options.length; i++) {
        if (callUsernameSelect.options[i].value === value) {
            callUsernameSelect.selectedIndex = i; // Select the option
            break;
        }
    }
}

// Remove option by value
function removeOptionByValue(value) {
    for (let i = 0; i < callUsernameSelect.options.length; i++) {
        if (callUsernameSelect.options[i].value === value) {
            alert(value);
            callUsernameSelect.remove(i); // Remove the matching option
            break;
        }
    }
}

// Start Session Time
function startSessionTime() {
    console.log('Start session time');
    elemDisplay(sessionTime, true, 'inline-flex');
    let sessionElapsedTime = 0;

    if (sessionTimerId !== null) {
        clearInterval(sessionTimerId);
    }

    sessionTimerId = setInterval(function printTime() {
        sessionElapsedTime++;
        sessionTime.innerText = secondsToHms(sessionElapsedTime);
    }, 1000);
}

// Stop Session Time
function stopSessionTime() {
    console.log('Stop session time');
    if (sessionTimerId !== null) {
        clearInterval(sessionTimerId);
        sessionTimerId = null;
    }
    elemDisplay(sessionTime, false);
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
        case 'users':
            handleUsers(data);
            break;
        case 'leave':
            handleLeave(false);
            break;
        case 'error':
            handleError(data.message, data.message);
            break;
        default:
            break;
    }
}

// Enumerate Devices for camera swap functionality
function handleEnumerateDevices() {
    navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
            const videoInputs = devices.filter((device) => device.kind === 'videoinput');
            if (videoInputs.length > 1 && userInfo.device.isMobile) {
                swapCameraBtn.addEventListener('click', swapCamera);
                elemDisplay(swapCameraBtn, true, 'inline');
            }
        })
        .catch((error) => {
            handleError('Error enumerating devices', error);
        });
}

// Handle Listeners
function handleListeners() {
    // Event listeners
    signInBtn.addEventListener('click', handleSignInClick);
    hideBtn.addEventListener('click', toggleLocalVideo);
    callBtn.addEventListener('click', handleCallClick);
    videoBtn.addEventListener('click', handleVideoClick);
    audioBtn.addEventListener('click', handleAudioClick);
    hangUpBtn.addEventListener('click', handleHangUpClick);
    localVideoContainer.addEventListener('click', toggleFullScreen);
    remoteVideo.addEventListener('click', toggleFullScreen);
    // Add keyUp listeners
    callUsernameSelect.addEventListener('keyup', (e) => handleKeyUp(e, handleCallClick));
    callUsernameSelect.addEventListener('change', (e) => handleChangeUserToCall(e));
    usernameIn.addEventListener('keyup', (e) => handleKeyUp(e, handleSignInClick));
}

// Handle element display
function elemDisplay(element, display, mode = 'block') {
    if (element) element.style.display = display ? mode : 'none';
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

// Toggle local video visibility
function toggleLocalVideo() {
    localVideoContainer.classList.toggle('hide');
}

// Handle Select user to call on changes
function handleChangeUserToCall(e) {
    const selectedValue = e.target.value;
    if (selectedValue) {
        console.log(`You selected: ${selectedValue}`);
        if (!callBtn.classList.contains('pulsate')) callBtn.classList.add('pulsate');
    }
}

// Handle call button click
function handleCallClick() {
    const callToUsername = callUsernameSelect.value.trim();
    if (callToUsername.length > 0) {
        if (callToUsername === userName) {
            handleError('You cannot call yourself.');
            return;
        }
        connectedUser = callToUsername;
        sendMsg({
            type: 'offerAccept',
            from: userName,
            to: callToUsername,
        });
        popupMsg(`You are calling ${callToUsername}.<br/>Please wait for them to answer.`);
        if (callBtn.classList.contains('pulsate')) callBtn.classList.remove('pulsate');
    } else {
        handleError('Please enter a username to call.');
    }
}

// Toggle video stream
function handleVideoClick() {
    const videoTrack = stream.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
    videoBtn.classList.toggle('btn-danger');
}

// Toggle audio stream
function handleAudioClick() {
    const audioTrack = stream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    audioBtn.classList.toggle('btn-danger');
}

// Function to swap between user-facing and environment cameras
function swapCamera() {
    camera = camera === 'user' ? 'environment' : 'user';

    const videoConstraints = camera === 'user' ? true : { facingMode: { exact: camera } };

    navigator.mediaDevices
        .getUserMedia({ video: videoConstraints })
        .then((newStream) => {
            // Stop the previous video track
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.stop();
            }
            // Refresh video streams
            refreshLocalVideoStream(newStream);
            refreshPeerVideoStreams(newStream);

            // Check video/audio status
            checkVideoAudioStatus();
        })
        .catch((error) => {
            handleError('Failed to swap the camera.', error);
        });
}

// Update the local video stream
function refreshLocalVideoStream(newStream) {
    const videoTrack = newStream.getVideoTracks()[0];
    if (!videoTrack) {
        handleError('No video track available in the newStream.');
        return;
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
        handleError('No audio track available in the stream.');
        return;
    }

    const updatedStream = new MediaStream([videoTrack, audioTrack]); // Create a new stream only with valid tracks

    stream = updatedStream;
    localVideo.srcObject = stream;
}

// Update the video stream for all peers
function refreshPeerVideoStreams(newStream) {
    if (!thisConnection) return;

    const videoTrack = newStream.getVideoTracks()[0];
    if (!videoTrack) {
        handleError('No video track available for peer connections.');
        return;
    }

    const videoSender = thisConnection.getSenders().find((sender) => sender.track && sender.track.kind === 'video');
    if (videoSender) {
        videoSender.replaceTrack(videoTrack).catch((error) => {
            handleError(`Replacing track error: ${error.message}`);
        });
    }
}

// Check video audio status
function checkVideoAudioStatus() {
    if (videoBtn.classList.contains('btn-danger')) {
        const videoTrack = stream.getVideoTracks()[0];
        videoTrack.enabled = false;
    }
    if (audioBtn.classList.contains('btn-danger')) {
        const audioTrack = stream.getAudioTracks()[0];
        audioTrack.enabled = false;
    }
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
            userInfo,
        },
    });
}

// Handle user not found from the server
function handleNotFound(data) {
    const { username } = data;
    handleError(`Username ${username} not found!`);
    removeOptionByValue(username);
}

// Handle sign-in response from the server
function handleSignIn(data) {
    const { success, message } = data;
    if (!success) {
        handleError(message);
        if (!message.startsWith('Invalid username')) {
            setTimeout(handleHangUpClick, 3000);
        }
    } else {
        elemDisplay(githubDiv, false);
        elemDisplay(attribution, false);
        elemDisplay(signInPage, false);
        elemDisplay(roomPage, true);

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
                handleEnumerateDevices();
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
            elemDisplay(callUsernameSelect, false);
        })
        .catch((error) => {
            handleError('Error when creating an offer.', error);
        });
}

// Accept incoming offer
function offerAccept(data) {
    // I'm already in call decline the new one!
    if (remoteVideo.srcObject) {
        data.type = 'offerBusy';
        sendMsg({ ...data });
        return;
    }

    sound('ring');

    Swal.fire({
        position: 'top',
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
            elemDisplay(callUsernameSelect, false);
            elemDisplay(callBtn, false);
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
    elemDisplay(callBtn, false);
    thisConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch((error) => {
        handleError('Error when add ice candidate.', error);
        elemDisplay(callBtn, true, 'inline');
    });
}

// Handle connected users
function handleUsers(data) {
    console.log('Connected users ------>', data.users);
    callUsernameSelect.innerHTML = '';
    data.users.forEach((user) => {
        if (user === userName) return;
        const option = document.createElement('option');
        option.value = user;
        option.textContent = user;
        callUsernameSelect.appendChild(option);
    });
    if (callUsernameSelect.options.length === 0) {
        callUsernameSelect.innerHTML = '<option value="" disabled selected>Select a user to call</option>';
        if (callBtn.classList.contains('pulsate')) callBtn.classList.remove('pulsate');
    } else {
        if (!callBtn.classList.contains('pulsate')) callBtn.classList.add('pulsate');
    }
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

// Helper function to stop all tracks and clear media stream
function stopMediaStream(videoElement) {
    if (videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach((track) => track.stop());
        videoElement.srcObject = null;
    }
}

// Helper function to disconnect and clean up the connection
function disconnectConnection() {
    if (thisConnection) {
        thisConnection.close();
        thisConnection = null;
    }
}

// Handle leaving the room
function handleLeave(disconnect = true) {
    if (disconnect) {
        // Stop local and remote video tracks
        stopMediaStream(localVideo);
        stopMediaStream(remoteVideo);

        // Disconnect from server and reset state
        disconnectConnection();
        connectedUser = null;

        // Redirect to homepage
        window.location.href = '/';
    } else {
        // Show UI elements
        elemDisplay(callUsernameSelect, true);
        elemDisplay(callBtn, true, 'inline');

        // Stop remote video tracks only
        stopMediaStream(remoteVideo);

        // Stop session time
        stopSessionTime();

        // Reset state
        connectedUser = null;
    }
}

// Handle and display errors
function handleError(message, error = false, position = 'top', timer = 6000) {
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
