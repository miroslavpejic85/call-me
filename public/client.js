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
const exitSidebarBtn = document.getElementById('exitSidebarBtn');
const userSidebar = document.getElementById('userSidebar');
const userSearchInput = document.getElementById('userSearchInput');
const userList = document.getElementById('userList');
const sidebarBtn = document.getElementById('sidebarBtn');
const hideBtn = document.getElementById('hideBtn');
const swapCameraBtn = document.getElementById('swapCameraBtn');
const videoBtn = document.getElementById('videoBtn');
const audioBtn = document.getElementById('audioBtn');
const hangUpBtn = document.getElementById('hangUpBtn');
const localVideoContainer = document.getElementById('localVideoContainer');
const localVideo = document.getElementById('localVideo');
const remoteAudioDisabled = document.getElementById('remoteAudioDisabled');
const remoteVideoDisabled = document.getElementById('remoteVideoDisabled');
const localUsername = document.getElementById('localUsername');
const remoteVideo = document.getElementById('remoteVideo');

// Ensure app is defined, even if config.js is not loaded
const app = window.myAppConfig || {};

// User and connection information
let userInfo;
let userName;
let connectedUser;
let thisConnection;
let camera = 'user';
let stream;

// User list state
let userSignedIn = false;
let allConnectedUsers = [];
let filteredUsers = [];
let selectedUser = null;

// Variable to store the interval ID
let sessionTimerId = null;

// On html page loaded...
document.addEventListener('DOMContentLoaded', async function () {
    userInfo = getUserInfo(userAgent);
    handleToolTip();
    handleLocalStorage();
    await handleDirectJoin();
    handleListeners();
    await fetchRandomImage();
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
appTitle.innerText = app?.title || 'Call-me';
appName.innerText = app?.name || 'Call-me';

const elementsToHide = [
    { condition: !(app?.showGithub ?? true), element: githubDiv },
    { condition: !(app?.attribution ?? true), element: attribution },
];

// Hide elements based on conditions
elementsToHide.forEach(({ condition, element }) => {
    if (condition && element) {
        elemDisplay(element, false);
    }
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
                    await checkHostPassword(maxRetries, attempts);
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
async function handleDirectJoin() {
    const usp = new URLSearchParams(window.location.search);
    const user = usp.get('user');
    const call = usp.get('call');
    const password = usp.get('password');

    if (user) {
        console.log('Direct Join detected', { user, call, password });

        // SignIn
        usernameIn.value = user;
        handleSignInClick();

        if (call) {
            // Call user if call is provided
            setTimeout(() => {
                handleUserClickToCall(call);
            }, 3000);
        }
    }

    if (!password) await checkHostPassword();
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
        case 'remoteAudio':
            handleRemoteAudio(data);
            break;
        case 'remoteVideo':
            handleRemoteVideo(data);
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
async function handleEnumerateDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((device) => device.kind === 'videoinput');
        if (videoInputs.length > 1 && userInfo.device.isMobile) {
            swapCameraBtn.addEventListener('click', swapCamera);
            elemDisplay(swapCameraBtn, true, 'inline');
        }
    } catch (error) {
        handleError('Error enumerating devices', error);
    }
}

// Handle Listeners
function handleListeners() {
    signInBtn.addEventListener('click', handleSignInClick);
    hideBtn.addEventListener('click', toggleLocalVideo);
    videoBtn.addEventListener('click', handleVideoClick);
    audioBtn.addEventListener('click', handleAudioClick);
    hangUpBtn.addEventListener('click', handleHangUpClick);
    exitSidebarBtn.addEventListener('click', handleExitSidebarClick);
    localVideoContainer.addEventListener('click', toggleFullScreen);
    remoteVideo.addEventListener('click', toggleFullScreen);
    usernameIn.addEventListener('keyup', (e) => handleKeyUp(e, handleSignInClick));

    // Sidebar toggle
    if (sidebarBtn && userSidebar) {
        sidebarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userSidebar.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (window.innerWidth > 768) return; // Ignore clicks on desktop
            let el = e.target;
            let shouldExclude = false;
            while (el) {
                if (el instanceof HTMLElement && (el.id === 'userSidebar' || el.id === 'sidebarBtn')) {
                    shouldExclude = true;
                    break;
                }
                el = el.parentElement;
            }
            if (!shouldExclude && userSidebar.classList.contains('active')) {
                userSidebar.classList.remove('active');
            }
        });
    }
}

// Hide sidebar after user selection (on mobile)
function handleUserClickToCall(user) {
    if (!user) {
        handleError('No user selected.');
        return;
    }
    if (user === userName) {
        handleError('You cannot call yourself.');
        return;
    }
    selectedUser = user;
    renderUserList();
    connectedUser = user;
    sendMsg({
        type: 'offerAccept',
        from: userName,
        to: user,
    });
    popupMsg(`You are calling ${user}.<br/>Please wait for them to answer.`);
    if (userSidebar.classList.contains('active')) {
        userSidebar.classList.remove('active');
    }
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
    // Stop video and audio if they are currently active
    if (!videoBtn.classList.contains('btn-danger')) {
        videoBtn.click();
    }
    if (!audioBtn.classList.contains('btn-danger')) {
        audioBtn.click();
    }
}

// Handle call button click
function handleCallBtnClick() {
    handleUserClickToCall(selectedUser);
}

// Toggle video stream
function handleVideoClick() {
    const videoTrack = stream.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
    videoBtn.classList.toggle('btn-danger');
    sendMsg({
        type: 'remoteVideo',
        enabled: videoTrack.enabled,
    });
}

// Toggle audio stream
function handleAudioClick() {
    const audioTrack = stream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    audioBtn.classList.toggle('btn-danger');
    sendMsg({
        type: 'remoteAudio',
        enabled: audioTrack.enabled,
    });
}

// Detect if back or front camera
function detectCameraFacingMode(stream) {
    if (!stream || !stream.getVideoTracks().length) {
        console.warn("No video track found in the stream. Defaulting to 'user'.");
        return 'user';
    }
    const videoTrack = stream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    const capabilities = videoTrack.getCapabilities?.() || {};
    const facingMode = settings.facingMode || capabilities.facingMode?.[0] || 'user';
    return facingMode === 'environment' ? 'environment' : 'user';
}

// Function to swap between user-facing and environment cameras
async function swapCamera() {
    camera = camera === 'user' ? 'environment' : 'user';

    const videoConstraints = camera === 'user' ? true : { facingMode: { exact: camera } };

    try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
        // Stop the previous video track
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.stop();
        }
        // Refresh video streams
        refreshLocalVideoStream(newStream);
        await refreshPeerVideoStreams(newStream);

        // Check video/audio status
        checkVideoAudioStatus();
    } catch (error) {
        handleError('Failed to swap the camera.', error);
    }
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

    handleVideoMirror(localVideo, stream);
}

// handle video mirror
function handleVideoMirror(video, stream) {
    const cameraFacingMode = detectCameraFacingMode(stream);
    cameraFacingMode === 'environment'
        ? video.classList.remove('mirror') // Back camera → No mirror
        : video.classList.add('mirror'); // Disable mirror for rear camera
}

// Update the video stream for all peers
async function refreshPeerVideoStreams(newStream) {
    if (!thisConnection) return;

    const videoTrack = newStream.getVideoTracks()[0];
    if (!videoTrack) {
        handleError('No video track available for peer connections.');
        return;
    }

    const videoSender = thisConnection.getSenders().find((sender) => sender.track && sender.track.kind === 'video');
    if (videoSender) {
        try {
            await videoSender.replaceTrack(videoTrack);
        } catch (error) {
            handleError(`Replacing track error: ${error.message}`);
        }
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

// Handle leaving the call
function handleExitSidebarClick() {
    if (userSidebar.classList.contains('active')) {
        userSidebar.classList.remove('active');
    }
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
    // Remove from user list if present
    allConnectedUsers = allConnectedUsers.filter((u) => u !== username);
    filterUserList(userSearchInput.value || '');
}

// Handle sign-in response from the server
async function handleSignIn(data) {
    const { success, message } = data;
    if (!success) {
        handleError(message);
        if (!message.startsWith('Invalid username')) {
            setTimeout(handleHangUpClick, 3000);
        }
    } else {
        userSignedIn = true;

        if (userInfo.device.isDesktop) userSidebar.classList.toggle('active');
        if (userInfo.device.isMobile) userSidebar.style.width = '100%';

        elemDisplay(githubDiv, false);
        elemDisplay(attribution, false);
        elemDisplay(signInPage, false);
        elemDisplay(roomPage, true);

        try {
            const myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            stream = myStream;
            localVideo.srcObject = stream;
            localVideo.playsInline = true;
            localVideo.autoplay = true;
            localVideo.muted = true;
            localVideo.volume = 0;
            localVideo.controls = false;
            localUsername.innerText = userName;
            initializeConnection();
            await handleEnumerateDevices();
            handleVideoMirror(localVideo, myStream);
        } catch (error) {
            handleMediaStreamError(error);
        }
    }
}

// Handle common media stream error
function handleMediaStreamError(error) {
    console.error('GetUserMedia error', error.message);

    let errorMessage = error;
    let shouldHandleGetUserMediaError = true;

    switch (error.name) {
        case 'NotFoundError':
        case 'DevicesNotFoundError':
            errorMessage = 'Required track is missing';
            break;
        case 'NotReadableError':
        case 'TrackStartError':
            errorMessage = 'Device is already in use';
            break;
        case 'OverconstrainedError':
        case 'ConstraintNotSatisfiedError':
            errorMessage = 'Constraints cannot be satisfied by available devices';
            break;
        case 'NotAllowedError':
        case 'PermissionDeniedError':
            errorMessage = 'Permission denied in browser';
            break;
        case 'AbortError':
            errorMessage = 'Operation aborted unexpectedly';
            break;
        case 'SecurityError':
            errorMessage = 'Security error: Check your connection or browser settings';
            break;
        default:
            errorMessage = "Can't get stream, make sure you are in a secure TLS context (HTTPS) and try again";
            shouldHandleGetUserMediaError = false;
            break;
    }

    if (shouldHandleGetUserMediaError) {
        errorMessage += `
        Check the common <a href="https://blog.addpipe.com/common-getusermedia-errors" target="_blank">getUserMedia errors</a></li>`;
    }

    Swal.fire({
        position: 'top',
        icon: 'warning',
        html: errorMessage,
        denyButtonText: 'Exit',
        showDenyButton: true,
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showClass: { popup: 'animate__animated animate__fadeInDown' },
        hideClass: { popup: 'animate__animated animate__fadeOutUp' },
    }).then((result) => {
        if (result.isDenied) {
            window.location.href = '/';
        }
    });

    sound('alert');
}

// Initialize WebRTC connection
function initializeConnection() {
    thisConnection = new RTCPeerConnection(config);

    stream.getTracks().forEach((track) => thisConnection.addTrack(track, stream));

    thisConnection.ontrack = (e) => {
        if (e.streams && e.streams[0]) {
            const remoteStream = e.streams[0];

            remoteVideo.srcObject = remoteStream;
            remoteVideo.playsInline = true;
            remoteVideo.autoplay = true;
            remoteVideo.controls = false;

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
async function offerCreate() {
    if (!thisConnection) {
        initializeConnection();
    }
    try {
        const offer = await thisConnection.createOffer();
        await thisConnection.setLocalDescription(offer);
        sendMsg({
            type: 'offer',
            offer,
        });
    } catch (error) {
        handleError('Error when creating an offer.', error);
    }
}

// Accept incoming offer
function offerAccept(data) {
    // I'm already in call decline the new one!
    if (remoteVideo.srcObject) {
        data.type = 'offerBusy';
        sendMsg({ ...data });
        return;
    }

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
            data.type = 'offerCreate';
            socket.recipient = data.from;
        } else {
            data.type = 'offerDecline';
        }
        sendMsg({ ...data });
    });

    sound('ring');
}

// Handle incoming offer
async function handleOffer(data) {
    const { offer, name } = data;
    connectedUser = name;
    initializeConnection();
    await thisConnection.setRemoteDescription(new RTCSessionDescription(offer));
    try {
        const answer = await thisConnection.createAnswer();
        await thisConnection.setLocalDescription(answer);
        sendMsg({
            type: 'answer',
            answer,
        });
    } catch (error) {
        handleError('Error when creating an answer.', error);
    }
}

// Handle incoming answer
async function handleAnswer(data) {
    const { answer } = data;
    try {
        await thisConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
        handleError('Error when set remote description.', error);
    }
}

// Handle incoming ICE candidate
async function handleCandidate(data) {
    const { candidate } = data;
    try {
        await thisConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
        handleError('Error when add ice candidate.', error);
    }
}

// Handle connected users
function handleUsers(data) {
    allConnectedUsers = data.users.filter((u) => u !== userName);
    filterUserList(userSearchInput.value || '');
}

// Handle remote video status
function handleRemoteVideo(data) {
    data.enabled ? remoteVideoDisabled.classList.remove('show') : remoteVideoDisabled.classList.add('show');
}

// Handle remote audio status
function handleRemoteAudio(data) {
    data.enabled ? remoteAudioDisabled.classList.remove('show') : remoteAudioDisabled.classList.add('show');
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
        // Stop remote video tracks only
        stopMediaStream(remoteVideo);

        // Stop session time
        stopSessionTime();

        // Reset remote video & audio status
        handleRemoteVideo({ enabled: true });
        handleRemoteAudio({ enabled: true });

        // Reset state
        connectedUser = null;
    }
}

// Handle and display errors
function handleError(message, error = false, position = 'top', timer = 6000) {
    if (error) console.error(error);

    Swal.fire({
        position,
        icon: 'warning',
        html: message,
        timerProgressBar: true,
        timer,
        showClass: { popup: 'animate__animated animate__fadeInDown' },
        hideClass: { popup: 'animate__animated animate__fadeOutUp' },
    });

    sound('notify');
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

// Select user by value in the user list
function renderUserList() {
    userList.innerHTML = '';
    filteredUsers.forEach((user) => {
        const li = document.createElement('li');
        li.tabIndex = 0;
        if (user === selectedUser) li.classList.add('selected');

        // Create call button
        const callBtnEl = document.createElement('button');
        callBtnEl.className = 'btn btn-custom btn-warning btn-s call-user-btn fas fa-phone';
        callBtnEl.title = `Call ${user}`;
        callBtnEl.setAttribute('data-toggle', 'tooltip');
        callBtnEl.setAttribute('data-placement', 'top');
        callBtnEl.style.marginRight = '10px';
        callBtnEl.style.cursor = 'pointer';
        callBtnEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!userSignedIn) return;
            handleUserClickToCall(user);
        });

        // Username span
        const nameSpan = document.createElement('span');
        nameSpan.textContent = user;

        li.appendChild(callBtnEl);
        li.appendChild(nameSpan);

        li.addEventListener('click', () => {
            if (!userSignedIn) return;
            selectedUser = user;
            renderUserList();
        });
        li.addEventListener('keydown', (e) => {
            if (!userSignedIn) return;
            if (e.key === 'Enter') handleUserClickToCall(user);
        });
        userList.appendChild(li);
    });
}

// Filter user list based on search input
function filterUserList(query) {
    filteredUsers = allConnectedUsers.filter((u) => u.toLowerCase().includes(query.toLowerCase()));
    // If selected user is filtered out, deselect
    if (!filteredUsers.includes(selectedUser)) selectedUser = null;
    renderUserList();
}

// Handle user search input
userSearchInput?.addEventListener('input', (e) => {
    filterUserList(e.target.value);
});

// Clean up before window close or reload
window.onbeforeunload = () => {
    handleHangUpClick();
};
