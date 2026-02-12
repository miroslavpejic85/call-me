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
const usersTab = document.getElementById('usersTab');
const chatTab = document.getElementById('chatTab');
const settingsTab = document.getElementById('settingsTab');
const usersContent = document.getElementById('usersContent');
const chatContent = document.getElementById('chatContent');
const settingsContent = document.getElementById('settingsContent');
const chatNotification = document.getElementById('chatNotification');
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const emojiBtn = document.getElementById('emojiBtn');
const emojiPicker = document.getElementById('emojiPicker');
const saveChatBtn = document.getElementById('saveChatBtn');
const clearChatBtn = document.getElementById('clearChatBtn');
const videoSelect = document.getElementById('videoSelect');
const audioSelect = document.getElementById('audioSelect');
const audioOutputSelect = document.getElementById('audioOutputSelect');
const testDevicesBtn = document.getElementById('testDevicesBtn');
const refreshDevicesBtn = document.getElementById('refreshDevicesBtn');
const shareRoomBtn = document.getElementById('shareRoomBtn');
const hideLocalVideoToggle = document.getElementById('hideLocalVideoToggle');
const swapCameraBtn = document.getElementById('swapCameraBtn');
const videoBtn = document.getElementById('videoBtn');
const audioBtn = document.getElementById('audioBtn');
const screenShareBtn = document.getElementById('screenShareBtn');
const leaveBtn = document.getElementById('leaveBtn');
const localVideoContainer = document.getElementById('localVideoContainer');
const localVideo = document.getElementById('localVideo');
const remoteAudioDisabled = document.getElementById('remoteAudioDisabled');
const remoteVideoDisabled = document.getElementById('remoteVideoDisabled');
const localUsername = document.getElementById('localUsername');
const remoteUsername = document.getElementById('remoteUsername');
const remoteVideo = document.getElementById('remoteVideo');

// Ensure app is defined, even if config.js is not loaded
const app = window.myAppConfig || {};

// User and connection information
let userInfo;
let userName;
let connectedUser;
let pendingUser; // Track outgoing call target
let thisConnection;
let camera = 'user';
let stream;
let isScreenSharing = false;
let originalStream = null; // Store original camera stream

// User list state
let userSignedIn = false;
let allConnectedUsers = [];
let filteredUsers = [];
let selectedUser = null;

// Chat state
let unreadMessages = 0;
let currentTab = 'users';

// Store last applied media status for reapplication after stream connection
let lastAppliedMediaStatus = null;

// Device state
let availableDevices = {
    videoInputs: [],
    audioInputs: [],
    audioOutputs: [],
};
let selectedDevices = {
    videoInput: null,
    audioInput: null,
    audioOutput: null,
};

// Variable to store the interval ID
let sessionTimerId = null;

// Data channel and file transfer state
let dataChannel = null;
let incomingFileMeta = null;
let incomingFileData = null;
let fileInput = null;
let pendingFileRecipient = null;
let incomingFileBuffers = [];
let incomingFileReceivedBytes = 0;
let outgoingTransfer = null;
let incomingTransfer = null;
let fileTransferStatusEl = null;

// On html page loaded...
document.addEventListener('DOMContentLoaded', async function () {
    userInfo = getUserInfo(userAgent);
    handleConfig();
    handleToolTip();
    handleLocalStorage();
    await handleDirectJoin();
    handleListeners();
    initializeFileSharing();
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

// Handle config - only set custom values if provided, otherwise let i18n handle it
function handleConfig() {
    // Only override if custom values are provided in config
    if (app?.title && app.title !== 'Call-me') {
        appTitle.innerText = app.title;
    }
    if (app?.name && app.name !== 'Call-me') {
        appName.innerText = app.name;
    }

    // Hide elements based on config conditions
    const elementsToHide = [
        { condition: !(app?.showGithub ?? true), element: githubDiv },
        { condition: !(app?.attribution ?? true), element: attribution },
    ];

    elementsToHide.forEach(({ condition, element }) => {
        if (condition && element) {
            elemDisplay(element, false);
        }
    });
}

async function checkHostPassword(maxRetries = 3, attempts = 0) {
    try {
        // Fetch host configuration
        const { data: config } = await axios.get('/api/hostPassword');

        if (config.isPasswordRequired) {
            // Show prompt for the password
            const { value: password } = await Swal.fire({
                heightAuto: false,
                scrollbarPadding: false,
                title: t('host.protectedTitle'),
                text: t('host.enterPassword'),
                input: 'password',
                inputPlaceholder: t('host.passwordPlaceholder'),
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
                confirmButtonText: t('host.submit'),
                denyButtonText: t('settings.cancel'),
                preConfirm: (password) => {
                    if (!password) {
                        Swal.showValidationMessage(t('host.passwordEmpty'));
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
                    heightAuto: false,
                    scrollbarPadding: false,
                    position: 'top',
                    icon: 'success',
                    title: t('host.accessGrantedTitle'),
                    text: t('host.accessGrantedText'),
                    timer: 1500,
                    showConfirmButton: false,
                });
                elemDisplay(signInPage, true);
            } else {
                attempts++;
                if (attempts < maxRetries) {
                    await Swal.fire({
                        heightAuto: false,
                        scrollbarPadding: false,
                        position: 'top',
                        icon: 'error',
                        title: t('host.invalidPasswordTitle'),
                        text: t('host.invalidPasswordText', { attempts, maxRetries }),
                    });
                    // Retry the process
                    await checkHostPassword(maxRetries, attempts);
                } else {
                    await Swal.fire({
                        heightAuto: false,
                        scrollbarPadding: false,
                        position: 'top',
                        icon: 'warning',
                        title: t('host.tooManyAttemptsTitle'),
                        text: t('host.tooManyAttemptsText'),
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
            heightAuto: false,
            scrollbarPadding: false,
            position: 'top',
            icon: 'error',
            title: t('messages.error'),
            text: t('host.joinError'),
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
    usernameIn.value = localStorage.callMeUsername
        ? localStorage.callMeUsername
        : 'Guest' + Math.floor(Math.random() * 10000);
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
    handleError(t('errors.socketError'), err.message);
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
            // Apply caller's media status when receiving offerCreate
            if (data.callerMediaStatus) {
                applyCallerMediaStatus(data.callerMediaStatus);
            }
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
        case 'remoteScreenShare':
            handleRemoteScreenShare(data);
            break;
        case 'chat':
            addChatMessage(data, false);
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
            elemDisplay(swapCameraBtn, true, 'inline-flex');
        }

        // Check if screen sharing is supported
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
            elemDisplay(screenShareBtn, true, 'inline-flex');
        } else {
            elemDisplay(screenShareBtn, false);
            console.log('Screen sharing not supported in this browser');
        }
    } catch (error) {
        handleError(t('errors.enumerateDevicesFailed'), error);
    }
}

// Handle Listeners
function handleListeners() {
    signInBtn.addEventListener('click', handleSignInClick);
    shareRoomBtn.addEventListener('click', async () => {
        await handleShareRoomClick();
    });
    hideLocalVideoToggle.addEventListener('change', toggleLocalVideo);
    videoBtn.addEventListener('click', handleVideoClick);
    audioBtn.addEventListener('click', handleAudioClick);
    screenShareBtn.addEventListener('click', handleScreenShareClick);
    leaveBtn.addEventListener('click', handleLeaveClick);
    exitSidebarBtn.addEventListener('click', handleExitSidebarClick);
    localVideoContainer.addEventListener('click', toggleFullScreen);
    remoteVideo.addEventListener('click', toggleFullScreen);
    usernameIn.addEventListener('keyup', (e) => handleKeyUp(e, handleSignInClick));
    usersTab.addEventListener('click', () => switchTab('users'));
    chatTab.addEventListener('click', () => switchTab('chat'));
    settingsTab.addEventListener('click', () => switchTab('settings'));
    // Settings event listeners
    videoSelect.addEventListener('change', handleVideoDeviceChange);
    audioSelect.addEventListener('change', handleAudioDeviceChange);
    audioOutputSelect.addEventListener('change', handleAudioOutputDeviceChange);
    testDevicesBtn.addEventListener('click', testDevices);
    refreshDevicesBtn.addEventListener('click', refreshDevices);
    // Chat event listeners
    emojiBtn.addEventListener('click', handleEmojiClick);
    saveChatBtn.addEventListener('click', handleSaveChatClick);
    clearChatBtn.addEventListener('click', handleClearChatClick);
    // Language change event listener - reapply config after translation
    window.addEventListener('languageChanged', () => {
        handleConfig();
    });

    // Sidebar toggle
    if (sidebarBtn && userSidebar) {
        sidebarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userSidebar.classList.toggle('active');
        });

        // Utility to handle click outside for any element
        function handleClickOutside(targetElement, triggerElement, callback, minWidth = 0) {
            document.addEventListener('click', (e) => {
                if (minWidth && window.innerWidth > minWidth) return;
                let el = e.target;
                let shouldExclude = false;
                while (el) {
                    if (el instanceof HTMLElement && (el === targetElement || el === triggerElement)) {
                        shouldExclude = true;
                        break;
                    }
                    el = el.parentElement;
                }
                if (!shouldExclude) callback();
            });
        }

        // Hide sidebar on mobile when clicking outside
        handleClickOutside(
            userSidebar,
            sidebarBtn,
            () => {
                if (userSidebar.classList.contains('active')) {
                    userSidebar.classList.remove('active');
                }
            },
            768
        );

        // Hide emoji picker when clicking outside
        handleClickOutside(emojiPicker, emojiBtn, () => {
            if (emojiPicker && emojiPicker.classList.contains('show')) {
                emojiPicker.classList.remove('show');
            }
        });
    }
}

// Initialize hidden file input and handlers for file sharing
function initializeFileSharing() {
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (!file) return;

        if (!dataChannel || dataChannel.readyState !== 'open') {
            toast(t('file.dataChannelNotReady'), 'warning', 'top', 3000);
            fileInput.value = '';
            return;
        }

        if (!connectedUser || pendingFileRecipient !== connectedUser) {
            toast(t('file.onlyActiveParticipant'), 'warning', 'top', 3000);
            fileInput.value = '';
            return;
        }

        try {
            await sendFileOverDataChannel(file);
        } catch (error) {
            handleError(t('file.failedToSend'), error.message || error);
        } finally {
            fileInput.value = '';
            pendingFileRecipient = null;
        }
    });

    // Create global file transfer status container (top-center of the screen)
    if (!fileTransferStatusEl) {
        fileTransferStatusEl = document.createElement('div');
        fileTransferStatusEl.id = 'fileTransferStatus';
        fileTransferStatusEl.className = 'file-transfer-status';
        document.body.appendChild(fileTransferStatusEl);
    }
}

// Hide sidebar after user selection (on mobile)
function handleUserClickToCall(user) {
    if (!user) {
        handleError(t('errors.noUserSelected'));
        return;
    }
    if (user === userName) {
        handleError(t('errors.cannotCallSelf'));
        return;
    }
    selectedUser = user;
    pendingUser = user;
    renderUserList();
    sendMsg({
        type: 'offerAccept',
        from: userName,
        to: user,
    });
    popupMsg(t('room.callingUser', { username: user }));
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

// Share Room click handler
async function handleShareRoomClick() {
    const roomUrl = window.location.origin;
    if (navigator.share) {
        try {
            await navigator.share({
                title: document.title,
                text: t('messages.shareRoomText'),
                url: roomUrl,
            });
        } catch (error) {
            await copyToClipboard(roomUrl, false);
        }
    } else {
        await copyToClipboard(roomUrl);
    }
}

// Copy text to clipboard
async function copyToClipboard(text, showError = true) {
    try {
        await navigator.clipboard.writeText(text);
        toast(t('messages.roomCopied', { text }), 'success', 'top', 3000);
    } catch (error) {
        showError
            ? handleError(t('errors.copyToClipboardFailed'), error.message)
            : console.error('Failed to copy to clipboard', error);
    }
}

// Toggle local video visibility
function toggleLocalVideo() {
    localVideoContainer.classList.toggle('hide');
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

    // Show/hide camera off overlay for local video
    showCameraOffOverlay('local', !videoTrack.enabled);

    // Send media status to server
    sendMediaStatusToServer();

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

    // Send media status to server
    sendMediaStatusToServer();

    sendMsg({
        type: 'remoteAudio',
        enabled: audioTrack.enabled,
    });
}

// Handle screen sharing toggle
async function handleScreenShareClick() {
    try {
        if (isScreenSharing) {
            // Stop screen sharing and return to camera
            await stopScreenSharing();
        } else {
            // Start screen sharing
            await startScreenSharing();
        }
    } catch (error) {
        handleError(t('errors.screenShareFailed'), error.message);
        console.error('Screen sharing error:', error);
    }
}

// Update remote video styling based on screen sharing state
function updateRemoteVideoStyling(isScreenSharing) {
    console.log('updateRemoteVideoStyling called with:', isScreenSharing);
    console.log('remoteVideo element:', remoteVideo);
    console.log('remoteVideo has srcObject:', !!remoteVideo?.srcObject);

    if (isScreenSharing) {
        remoteVideo.classList.add('screen-share');
        remoteVideo.classList.remove('camera-feed');
        console.log('Applied screen-share styling. Classes:', remoteVideo.className);
    } else {
        remoteVideo.classList.add('camera-feed');
        remoteVideo.classList.remove('screen-share');
        console.log('Applied camera-feed styling. Classes:', remoteVideo.className);
    }
}

// Start screen sharing
async function startScreenSharing() {
    try {
        // Store original camera stream
        originalStream = stream;

        // Store original video enabled state
        const originalVideoTrack = originalStream.getVideoTracks()[0];
        const wasVideoEnabled = originalVideoTrack ? originalVideoTrack.enabled : true;

        // Get screen share stream
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                cursor: 'always',
                displaySurface: 'monitor',
            },
            audio: true,
        });

        // Keep original audio track if available
        const audioTrack = originalStream.getAudioTracks()[0];
        if (audioTrack) {
            screenStream.addTrack(audioTrack);
        }

        // Apply original video enabled state to screen share track
        const screenVideoTrack = screenStream.getVideoTracks()[0];
        if (screenVideoTrack) {
            screenVideoTrack.enabled = wasVideoEnabled;
        }

        // Update stream and local video
        stream = screenStream;
        localVideo.srcObject = stream;
        localVideo.classList.remove('mirror'); // Remove mirror for screen share
        localVideo.classList.add('screen-share'); // Apply screen share styling
        localVideo.classList.remove('camera-feed');

        // Show/hide camera off overlay based on video state
        showCameraOffOverlay('local', !wasVideoEnabled);

        console.log('Local video classes after screen share start:', localVideo.className);
        console.log('Screen share video enabled state:', wasVideoEnabled);

        // Update peer connection if it exists
        if (thisConnection) {
            const videoSender = thisConnection
                .getSenders()
                .find((sender) => sender.track && sender.track.kind === 'video');
            if (videoSender) {
                await videoSender.replaceTrack(screenStream.getVideoTracks()[0]);
            }
        }

        // Update UI
        isScreenSharing = true;
        screenShareBtn.classList.add('btn-warning');
        screenShareBtn.classList.remove('btn-success');
        screenShareBtn.title = t('controls.stopScreenShare');
        screenShareBtn.innerHTML = '<i class="fas fa-stop"></i>';

        // Send screen sharing status to server
        sendMediaStatusToServer();

        // Ensure UI button state matches actual video state
        if (!wasVideoEnabled) {
            // If video was disabled before screen sharing, keep the video button in disabled state
            if (!videoBtn.classList.contains('btn-danger')) {
                videoBtn.classList.add('btn-danger');
            }
        }

        // Listen for screen share end (user clicks browser's stop sharing)
        screenStream.getVideoTracks()[0].onended = () => {
            stopScreenSharing();
        };

        toast(t('messages.screenShareStarted'), 'success', 'top', 2000);
        console.log('Screen sharing started');
    } catch (error) {
        if (error.name === 'NotAllowedError') {
            handleError(t('errors.screenSharePermissionDenied'));
        } else if (error.name === 'NotSupportedError') {
            handleError(t('errors.screenShareNotSupported'));
        } else {
            handleError(t('errors.screenShareStartFailed'), error.message);
        }
        throw error;
    }
}

// Stop screen sharing
async function stopScreenSharing() {
    try {
        if (!originalStream) {
            handleError(t('errors.noOriginalStreamAvailable'));
            return;
        }

        // Store screen share video enabled state to restore to camera
        const screenVideoTrack = stream.getVideoTracks()[0];
        const currentVideoEnabled = screenVideoTrack ? screenVideoTrack.enabled : true;

        // Stop screen share tracks
        if (stream) {
            stream.getTracks().forEach((track) => {
                if (track.kind === 'video' || (track.kind === 'audio' && track.label.includes('monitor'))) {
                    track.stop();
                }
            });
        }

        // Restore original camera stream
        stream = originalStream;

        // Apply the video enabled state from screen share to camera
        const cameraVideoTrack = stream.getVideoTracks()[0];
        if (cameraVideoTrack) {
            cameraVideoTrack.enabled = currentVideoEnabled;
        }

        localVideo.srcObject = stream;
        handleVideoMirror(localVideo, stream); // Restore mirror for camera
        localVideo.classList.remove('screen-share'); // Remove screen share styling
        localVideo.classList.add('camera-feed'); // Apply camera feed styling

        // Show/hide camera off overlay based on video state
        showCameraOffOverlay('local', !currentVideoEnabled);

        console.log('Local video classes after screen share stop:', localVideo.className);
        console.log('Restored camera video enabled state:', currentVideoEnabled);

        // Update peer connection if it exists
        if (thisConnection) {
            const videoSender = thisConnection
                .getSenders()
                .find((sender) => sender.track && sender.track.kind === 'video');
            if (videoSender && originalStream.getVideoTracks()[0]) {
                await videoSender.replaceTrack(originalStream.getVideoTracks()[0]);
            }
        }

        // Update UI
        isScreenSharing = false;
        screenShareBtn.classList.remove('btn-warning');
        screenShareBtn.classList.add('btn-success');
        screenShareBtn.title = t('controls.startScreenShare');
        screenShareBtn.innerHTML = '<i class="fas fa-desktop"></i>';

        // Send screen sharing status to server
        sendMediaStatusToServer();

        // Reset original stream reference
        originalStream = null;

        // Ensure UI button state matches actual video state
        checkVideoAudioStatus();

        toast(t('messages.screenShareStopped'), 'success', 'top', 2000);
        console.log('Screen sharing stopped');
    } catch (error) {
        handleError(t('errors.screenShareStopFailed'), error.message);
        console.error('Stop screen sharing error:', error);
    }
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
        handleError(t('errors.swapCameraFailed'), error);
    }
}

// Update the local video stream
function refreshLocalVideoStream(newStream) {
    const videoTrack = newStream.getVideoTracks()[0];
    if (!videoTrack) {
        handleError(t('errors.noVideoTrackInStream'));
        return;
    }

    // Preserve previous video enabled state (if the user had video disabled)
    let wasVideoEnabled = true;
    try {
        if (stream && stream.getVideoTracks().length > 0) {
            wasVideoEnabled = stream.getVideoTracks()[0].enabled;
        } else if (videoBtn && videoBtn.classList.contains('btn-danger')) {
            wasVideoEnabled = false;
        }
    } catch (e) {
        console.warn('Could not determine previous video enabled state:', e);
    }

    // Apply preserved enabled state to new track
    videoTrack.enabled = wasVideoEnabled;

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
        handleError(t('errors.noAudioTrackInStream'));
        return;
    }

    const updatedStream = new MediaStream([videoTrack, audioTrack]); // Create a new stream only with valid tracks

    stream = updatedStream;
    localVideo.srcObject = stream;

    // Ensure camera feed styling is maintained during swap
    localVideo.classList.add('camera-feed');
    localVideo.classList.remove('screen-share');

    // Reflect video state in UI and overlays
    if (wasVideoEnabled) {
        videoBtn && videoBtn.classList.remove('btn-danger');
        showCameraOffOverlay('local', false);
    } else {
        videoBtn && videoBtn.classList.add('btn-danger');
        showCameraOffOverlay('local', true);
    }

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
        handleError(t('errors.noVideoTrackForPeer'));
        return;
    }

    const videoSender = thisConnection.getSenders().find((sender) => sender.track && sender.track.kind === 'video');
    if (videoSender) {
        try {
            await videoSender.replaceTrack(videoTrack);
        } catch (error) {
            handleError(t('errors.replacingTrack', { message: error.message }));
        }
    }
}

// Check video audio status
function checkVideoAudioStatus() {
    if (videoBtn.classList.contains('btn-danger')) {
        const videoTrack = stream.getVideoTracks()[0];
        videoTrack.enabled = false;
        // Show camera off overlay for local video
        showCameraOffOverlay('local', true);
    } else {
        // Hide camera off overlay for local video
        showCameraOffOverlay('local', false);
    }
    if (audioBtn.classList.contains('btn-danger')) {
        const audioTrack = stream.getAudioTracks()[0];
        audioTrack.enabled = false;
    }
}

// Handle leave button click
function handleLeaveClick() {
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
    handleError(t('errors.userNotFound', { username }));
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
            setTimeout(handleLeaveClick, 3000);
        }
    } else {
        userSignedIn = true;

        if (userInfo.device.isDesktop) userSidebar.classList.toggle('active');
        if (userInfo.device.isMobile) userSidebar.style.width = '100%';

        elemDisplay(githubDiv, false);
        elemDisplay(attribution, false);
        elemDisplay(signInPage, false);
        elemDisplay(roomPage, true);

        let myStream = null;
        let lastError = null;

        // Try to get media with progressive fallback
        try {
            // Try video + audio first
            myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            console.log('Successfully obtained video + audio stream');
        } catch (error) {
            lastError = error;
            console.warn('Video + audio failed, trying video only:', error.name);
            try {
                // Try video only
                myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                console.log('Successfully obtained video-only stream');
            } catch (error2) {
                lastError = error2;
                console.warn('Video only failed, trying audio only:', error2.name);
                try {
                    // Try audio only
                    myStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                    console.log('Successfully obtained audio-only stream');
                } catch (error3) {
                    lastError = error3;
                    console.error('All getUserMedia attempts failed:', error3.name);
                }
            }
        }

        if (myStream) {
            stream = myStream;
            localVideo.srcObject = stream;
            localVideo.playsInline = true;
            localVideo.autoplay = true;
            localVideo.muted = true;
            localVideo.volume = 0;
            localVideo.controls = false;
            localVideo.classList.add('camera-feed'); // Set default styling for camera
            localUsername.innerText = userName;
            updateUsernameDisplay();
            initializeConnection();
            await handleEnumerateDevices();
            // Initialize device settings after getting media
            await initializeDeviceSettings();
            handleVideoMirror(localVideo, myStream);

            // Update UI based on available devices
            updateUIForAvailableDevices();

            // Send initial media status to server
            sendMediaStatusToServer();
        } else {
            // All attempts failed, show error only now
            handleMediaStreamError(lastError);
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
            errorMessage = t('errors.getUserMediaNotFound');
            break;
        case 'NotReadableError':
        case 'TrackStartError':
            errorMessage = t('errors.getUserMediaInUse');
            break;
        case 'OverconstrainedError':
        case 'ConstraintNotSatisfiedError':
            errorMessage = t('errors.getUserMediaConstraints');
            break;
        case 'NotAllowedError':
        case 'PermissionDeniedError':
            errorMessage = t('errors.getUserMediaPermissionDenied');
            break;
        case 'AbortError':
            errorMessage = t('errors.getUserMediaAborted');
            break;
        case 'SecurityError':
            errorMessage = t('errors.getUserMediaSecurity');
            break;
        default:
            errorMessage = t('errors.getUserMediaDefault');
            shouldHandleGetUserMediaError = false;
            break;
    }

    if (shouldHandleGetUserMediaError) {
        errorMessage += t('errors.getUserMediaHelp');
    }

    Swal.fire({
        heightAuto: false,
        scrollbarPadding: false,
        position: 'top',
        icon: 'warning',
        html: errorMessage,
        denyButtonText: t('common.exit'),
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

    // Handle incoming data channels (file transfer, etc.)
    thisConnection.ondatachannel = (event) => {
        const channel = event.channel;
        setupDataChannel(channel);
    };

    // Add existing tracks from local stream
    stream.getTracks().forEach((track) => thisConnection.addTrack(track, stream));

    // Ensure we have transceivers for both audio and video, even if we don't have those tracks
    // This allows us to receive video/audio from remote peer even if we don't have camera/mic
    const hasVideo = stream.getVideoTracks().length > 0;
    const hasAudio = stream.getAudioTracks().length > 0;

    if (!hasVideo) {
        // Add video transceiver to receive video from remote peer
        thisConnection.addTransceiver('video', { direction: 'recvonly' });
        console.log('Added recvonly video transceiver (no local camera)');
    }

    if (!hasAudio) {
        // Add audio transceiver to receive audio from remote peer
        thisConnection.addTransceiver('audio', { direction: 'recvonly' });
        console.log('Added recvonly audio transceiver (no local microphone)');
    }

    thisConnection.ontrack = (e) => {
        if (e.streams && e.streams[0]) {
            const remoteStream = e.streams[0];

            remoteVideo.srcObject = remoteStream;
            remoteVideo.playsInline = true;
            remoteVideo.autoplay = true;
            remoteVideo.controls = false;

            // Initial styling - will be updated via server status
            remoteVideo.classList.add('camera-feed');
            remoteVideo.classList.remove('screen-share');

            startSessionTime();
            renderUserList(); // Update UI to show hang-up button

            console.log('Remote stream set to video element');

            // Reapply media status after stream is connected (in case caller had screen sharing on)
            reapplyRemoteMediaStatus();
        } else {
            handleError(t('errors.noStreamInOnTrack'));
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
    // Always initialize a fresh connection for new calls
    console.log('Creating new offer - initializing fresh connection');
    initializeConnection();

    // Create data channel for file transfer on the offerer side
    const channel = thisConnection.createDataChannel('fileTransfer');
    setupDataChannel(channel);

    try {
        const offer = await thisConnection.createOffer();
        await thisConnection.setLocalDescription(offer);
        sendMsg({
            type: 'offer',
            offer,
        });
        console.log('Offer created and sent successfully');
    } catch (error) {
        handleError(t('errors.offerCreateFailed'), error);
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
        heightAuto: false,
        scrollbarPadding: false,
        position: 'top',
        imageUrl: 'assets/ring.png',
        imageWidth: 284,
        imageHeight: 120,
        text: t('room.acceptCallFrom', { username: data.from }),
        showDenyButton: true,
        confirmButtonText: t('common.yes'),
        denyButtonText: t('common.no'),
        timerProgressBar: true,
        timer: 10000,
        showClass: { popup: 'animate__animated animate__fadeInDown' },
        hideClass: { popup: 'animate__animated animate__fadeOutUp' },
    }).then((result) => {
        if (result.isConfirmed) {
            // Apply caller's media status before accepting the call
            if (data.callerMediaStatus) {
                applyCallerMediaStatus(data.callerMediaStatus);
            }

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
    console.log('Handling offer from:', name);
    connectedUser = name;
    pendingUser = null;
    updateUsernameDisplay();

    // Initialize fresh connection for incoming call
    initializeConnection();

    await thisConnection.setRemoteDescription(new RTCSessionDescription(offer));
    try {
        const answer = await thisConnection.createAnswer();
        await thisConnection.setLocalDescription(answer);
        sendMsg({
            type: 'answer',
            answer,
        });
        console.log('Answer sent successfully to:', name);
    } catch (error) {
        handleError(t('errors.answerCreateFailed'), error);
    }
}

// Handle incoming answer
async function handleAnswer(data) {
    const { answer } = data;
    try {
        await thisConnection.setRemoteDescription(new RTCSessionDescription(answer));
        // Set connectedUser from pendingUser after call is accepted
        if (pendingUser) {
            connectedUser = pendingUser;
            pendingUser = null;
            updateUsernameDisplay();
        }
    } catch (error) {
        handleError(t('errors.remoteDescriptionFailed'), error);
    }
}

// Handle incoming ICE candidate
async function handleCandidate(data) {
    const { candidate } = data;
    try {
        await thisConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
        handleError(t('errors.addIceCandidateFailed'), error);
    }
}

// Handle connected users
function handleUsers(data) {
    // Show toast for new users
    const prevUsers = new Set(allConnectedUsers);
    const currentUsers = data.users.filter((u) => u !== userName);
    allConnectedUsers = currentUsers;
    filterUserList(userSearchInput.value || '');
    if (userSignedIn) {
        currentUsers.forEach((u) => {
            if (!prevUsers.has(u)) {
                toast(t('room.userJoined', { username: u }), 'success');
            }
        });
    }
}

// Handle remote video status
function handleRemoteVideo(data) {
    data.enabled ? remoteVideoDisabled.classList.remove('show') : remoteVideoDisabled.classList.add('show');

    // Show/hide camera off overlay for remote video
    showCameraOffOverlay('remote', !data.enabled);
}

// Handle remote audio status
function handleRemoteAudio(data) {
    data.enabled ? remoteAudioDisabled.classList.remove('show') : remoteAudioDisabled.classList.add('show');
}

// Update username displays on video containers
function updateUsernameDisplay() {
    if (localUsername) {
        localUsername.innerText = userName || 'You';
    }
    // Only show remoteUsername if call is established (not just pending)
    if (remoteUsername && connectedUser) {
        remoteUsername.innerText = connectedUser;
        remoteUsername.classList.remove('hide');
    } else if (remoteUsername) {
        remoteUsername.innerText = '';
        remoteUsername.classList.add('hide');
    }
}

// Show/hide camera off overlay with username display
function showCameraOffOverlay(type, show) {
    const container =
        type === 'local'
            ? document.getElementById('localVideoContainer')
            : document.getElementById('remoteVideoContainer');
    let overlay = container.querySelector('.camera-off-overlay');

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'camera-off-overlay';
        container.appendChild(overlay);
    }

    if (show) {
        const username = type === 'local' ? userName : connectedUser;
        overlay.innerHTML = `
            <img src="./assets/camOff.png" alt="${t('room.videoOff')}" />
            <span class="username">${username || (type === 'local' ? t('room.localUsername') : t('room.remoteUsername'))}</span>
            <span class="status">${type === 'local' ? t('room.videoOff') : t('room.videoDisabled')}</span>
        `;
    }

    overlay.classList.toggle('show', show);

    // Hide/show username elements when video is off/on
    const usernameElement = type === 'local' ? localUsername : remoteUsername;
    if (usernameElement) {
        if (show) {
            // Video is off - hide username
            usernameElement.classList.add('hide');
        } else {
            // Video is on - show username only if conditions are met
            if (type === 'local') {
                // Always show local username when video is on
                usernameElement.classList.remove('hide');
            } else {
                // For remote username, only show if user is connected
                if (connectedUser) {
                    usernameElement.classList.remove('hide');
                }
                // If no connected user, keep it hidden (handled by updateUsernameDisplay)
            }
        }
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

    if (dataChannel) {
        try {
            dataChannel.close();
        } catch (e) {
            console.warn('Error closing data channel', e);
        }
        dataChannel = null;
    }

    incomingFileMeta = null;
    incomingFileData = null;
    incomingFileBuffers = [];
    incomingFileReceivedBytes = 0;
    outgoingTransfer = null;
    incomingTransfer = null;
    renderFileTransferStatus();
}

// Handle leaving the room
function handleLeave(disconnect = true) {
    if (disconnect) {
        // Stop screen sharing if active
        if (isScreenSharing) {
            stopScreenSharing();
        }

        // Stop local and remote video tracks
        stopMediaStream(localVideo);
        stopMediaStream(remoteVideo);

        // Disconnect from server and reset state
        disconnectConnection();
        connectedUser = null;
        lastAppliedMediaStatus = null; // Clear stored media status
        updateUsernameDisplay();

        // Redirect to homepage
        window.location.href = '/';
    } else {
        // Remote user left - clean up properly for new connections
        console.log('Remote user left - cleaning up connection');

        // Stop screen sharing if active
        if (isScreenSharing) {
            stopScreenSharing();
        }

        // Stop remote video tracks only
        stopMediaStream(remoteVideo);

        // Reset remote video styling
        remoteVideo.classList.remove('screen-share', 'camera-feed');

        // Clean up the peer connection so new connections work properly
        disconnectConnection();

        // Stop session time
        stopSessionTime();

        // Reset remote video & audio status indicators
        handleRemoteVideo({ enabled: true });
        handleRemoteAudio({ enabled: true });

        // Reset state
        connectedUser = null;
        lastAppliedMediaStatus = null; // Clear stored media status
        updateUsernameDisplay();
        renderUserList();

        console.log('Remote user cleanup completed - ready for new connections');
    }
}

// Display toast messages
function toast(message, icon = 'info', position = 'top', timer = 3000) {
    Swal.fire({
        heightAuto: false,
        scrollbarPadding: false,
        position,
        icon,
        html: message,
        timer,
        timerProgressBar: true,
        showConfirmButton: false,
        showClass: { popup: 'animate__animated animate__fadeInDown' },
        hideClass: { popup: 'animate__animated animate__fadeOutUp' },
    });
}

// Handle and display errors
function handleError(message, error = false, position = 'top', timer = 6000) {
    if (error) console.error(error);

    Swal.fire({
        heightAuto: false,
        scrollbarPadding: false,
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
        heightAuto: false,
        scrollbarPadding: false,
        position,
        html: message,
        timerProgressBar: true,
        timer,
        showClass: { popup: 'animate__animated animate__fadeInDown' },
        hideClass: { popup: 'animate__animated animate__fadeOutUp' },
    });
}

// Send current media status to server
function sendMediaStatusToServer() {
    if (!stream) return;

    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];

    const mediaStatus = {
        type: 'mediaStatus',
        video: videoTrack ? videoTrack.enabled : false,
        audio: audioTrack ? audioTrack.enabled : false,
        screenSharing: isScreenSharing,
    };

    socket.emit('message', mediaStatus);
    console.log('Sent media status to server:', mediaStatus);
}

// Apply caller's media status to remote video/audio indicators
function applyCallerMediaStatus(callerMediaStatus) {
    if (!callerMediaStatus) return;

    console.log('Applying caller media status:', callerMediaStatus);

    // Store for potential reapplication after stream connection
    lastAppliedMediaStatus = callerMediaStatus;

    // Apply video status
    if (!callerMediaStatus.video) {
        remoteVideoDisabled.classList.add('show');
        showCameraOffOverlay('remote', true);
    } else {
        remoteVideoDisabled.classList.remove('show');
        showCameraOffOverlay('remote', false);
    }

    // Apply audio status
    if (!callerMediaStatus.audio) {
        remoteAudioDisabled.classList.add('show');
    } else {
        remoteAudioDisabled.classList.remove('show');
    }

    // Apply screen sharing status
    if (callerMediaStatus.screenSharing) {
        updateRemoteVideoStyling(true);
    } else {
        updateRemoteVideoStyling(false);
    }
}

// Reapply media status after stream connection
function reapplyRemoteMediaStatus() {
    if (lastAppliedMediaStatus) {
        console.log('Reapplying media status after stream connection:', lastAppliedMediaStatus);

        // Only reapply screen sharing status since video/audio indicators should be preserved
        if (lastAppliedMediaStatus.screenSharing) {
            updateRemoteVideoStyling(true);
        } else {
            updateRemoteVideoStyling(false);
        }
    }
}

// Handle remote screen sharing status updates
function handleRemoteScreenShare(data) {
    const { from, screenSharing } = data;

    // Only apply if this message is from the connected user
    if (from === connectedUser) {
        console.log('Remote screen sharing status changed:', screenSharing);

        // Update stored media status
        if (lastAppliedMediaStatus) {
            lastAppliedMediaStatus.screenSharing = screenSharing;
        }

        updateRemoteVideoStyling(screenSharing);
    }
}

// Send messages to the server
function sendMsg(message) {
    // Use connectedUser if call is established, otherwise use pendingUser for signaling
    if (connectedUser) {
        message.name = connectedUser;
    } else if (pendingUser) {
        message.name = pendingUser;
    }
    socket.emit('message', message);
}

// Set up a data channel for file transfer
function setupDataChannel(channel) {
    dataChannel = channel;

    dataChannel.onopen = () => {
        console.log('Data channel open for file transfer');
    };

    dataChannel.onclose = () => {
        console.log('Data channel closed');
    };

    dataChannel.onerror = (event) => {
        // Some browsers emit an error event during/after close (e.g. "User-Initiated Abort, reason=Close called").
        // That's expected during hang-up/teardown and shouldn't be shown to the user.
        const rtcError = event?.error;
        const message = (rtcError && (rtcError.message || rtcError.reason)) || '';
        const isClosingOrClosed = dataChannel?.readyState && dataChannel.readyState !== 'open';
        const isBenignCloseError =
            rtcError?.name === 'OperationError' && /close called|user-initiated abort|abort/i.test(String(message));

        if (isClosingOrClosed || isBenignCloseError) {
            console.debug('Ignoring data channel close-related error:', event);
            return;
        }

        console.error('Data channel error:', event);
        toast(t('file.dataChannelError'), 'warning', 'top', 3000);
    };

    dataChannel.onmessage = async (event) => {
        // Meta information is sent as JSON string, file as binary
        if (typeof event.data === 'string') {
            try {
                const msg = JSON.parse(event.data);
                if (msg && msg.type === 'file-meta') {
                    incomingFileMeta = msg;
                    incomingFileData = null;
                    incomingFileBuffers = [];
                    incomingFileReceivedBytes = 0;
                    incomingTransfer = {
                        id: msg.id,
                        name: msg.name,
                        size: msg.size,
                        receivedBytes: 0,
                        cancelled: false,
                    };
                    console.log('Received file meta:', msg);
                    renderFileTransferStatus();
                    return;
                }

                if (msg && msg.type === 'file-cancel') {
                    console.log('Received file cancel:', msg);
                    if (incomingTransfer && (!msg.id || msg.id === incomingTransfer.id)) {
                        incomingTransfer.cancelled = true;
                        incomingTransfer = null;
                        incomingFileMeta = null;
                        incomingFileData = null;
                        incomingFileBuffers = [];
                        incomingFileReceivedBytes = 0;
                        toast(t('file.cancelledByRemote'), 'info', 'top', 3000);
                        renderFileTransferStatus();
                    }
                    if (outgoingTransfer && (!msg.id || msg.id === outgoingTransfer.id)) {
                        outgoingTransfer.cancelled = true;
                        outgoingTransfer = null;
                        toast(t('file.cancelledByRemote'), 'info', 'top', 3000);
                        renderFileTransferStatus();
                    }
                    return;
                }
            } catch (e) {
                console.warn('Non-JSON data received on data channel:', event.data);
            }
        } else {
            if (!incomingFileMeta) {
                console.warn('Received binary data without file meta');
                return;
            }

            let arrayBuffer;
            if (event.data instanceof ArrayBuffer) {
                arrayBuffer = event.data;
            } else if (event.data instanceof Blob) {
                arrayBuffer = await event.data.arrayBuffer();
            } else {
                console.warn('Unknown binary data type on data channel');
                return;
            }
            // Accumulate chunks until full file is received
            incomingFileBuffers.push(arrayBuffer);
            incomingFileReceivedBytes += arrayBuffer.byteLength;

            if (incomingTransfer) {
                incomingTransfer.receivedBytes = incomingFileReceivedBytes;
                renderFileTransferStatus();
            }

            if (incomingFileReceivedBytes >= incomingFileMeta.size) {
                const blob = new Blob(incomingFileBuffers, {
                    type: incomingFileMeta.mime || 'application/octet-stream',
                });
                const url = URL.createObjectURL(blob);

                addFileMessageToChat({
                    from: connectedUser || 'Remote',
                    name: incomingFileMeta.name,
                    size: incomingFileMeta.size,
                    url,
                    isSelf: false,
                });

                incomingFileMeta = null;
                incomingFileData = null;
                incomingFileBuffers = [];
                incomingFileReceivedBytes = 0;
                incomingTransfer = null;
                renderFileTransferStatus();
            }
        }
    };
}

// Send a file over the data channel to the connected peer
async function sendFileOverDataChannel(file) {
    if (!dataChannel || dataChannel.readyState !== 'open') {
        throw new Error('Data channel is not open');
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_FILE_SIZE) {
        handleError(t('file.tooLarge', { maxSizeMb: 10 }));
        return;
    }

    const transferId = Date.now() + '-' + Math.random().toString(16).slice(2);

    const meta = {
        type: 'file-meta',
        id: transferId,
        name: file.name,
        size: file.size,
        mime: file.type || 'application/octet-stream',
    };

    try {
        outgoingTransfer = {
            id: transferId,
            name: file.name,
            size: file.size,
            sentBytes: 0,
            cancelled: false,
        };
        renderFileTransferStatus();

        dataChannel.send(JSON.stringify(meta));
        const arrayBuffer = await file.arrayBuffer();

        // Send the file in small chunks to avoid data channel send errors
        const CHUNK_SIZE = 16 * 1024; // 16 KB
        for (let offset = 0; offset < arrayBuffer.byteLength; offset += CHUNK_SIZE) {
            if (!dataChannel || dataChannel.readyState !== 'open') {
                throw new Error('Data channel closed during file transfer');
            }

            if (!outgoingTransfer || outgoingTransfer.cancelled) {
                outgoingTransfer = null;
                renderFileTransferStatus();
                return;
            }

            const chunk = arrayBuffer.slice(offset, offset + CHUNK_SIZE);
            dataChannel.send(chunk);
            if (outgoingTransfer) {
                outgoingTransfer.sentBytes = offset + chunk.byteLength;
                renderFileTransferStatus();
            }

            await waitForDataChannelDrain();
        }

        const blobUrl = URL.createObjectURL(new Blob([arrayBuffer], { type: meta.mime }));

        addFileMessageToChat({
            from: userName || t('chat.me'),
            name: file.name,
            size: file.size,
            url: blobUrl,
            isSelf: true,
        });

        toast(t('file.sent', { filename: file.name }), 'success', 'top', 3000);
        outgoingTransfer = null;
        renderFileTransferStatus();
    } catch (error) {
        console.error('Error sending file over data channel:', error);
        handleError(t('file.sendError'), error.message || error);
        outgoingTransfer = null;
        renderFileTransferStatus();
    }
}

// Wait for data channel buffer to drain below a threshold
async function waitForDataChannelDrain() {
    if (!dataChannel || dataChannel.readyState !== 'open') return;

    const MAX_BUFFERED_AMOUNT = 64 * 1024; // 64 KB
    if (dataChannel.bufferedAmount < MAX_BUFFERED_AMOUNT) return;

    await new Promise((resolve) => {
        const check = () => {
            if (!dataChannel || dataChannel.readyState !== 'open' || dataChannel.bufferedAmount < MAX_BUFFERED_AMOUNT) {
                resolve();
            } else {
                setTimeout(check, 50);
            }
        };
        check();
    });
}

// Select user by value in the user list
function renderUserList() {
    userList.innerHTML = '';
    filteredUsers.forEach((user) => {
        const li = document.createElement('li');
        li.tabIndex = 0;
        if (user === selectedUser) li.classList.add('selected');

        // Check if this user is currently in an active call (has answered)
        const isInActiveCall =
            connectedUser === user && remoteVideo.srcObject && remoteVideo.srcObject.getTracks().length > 0;

        // Create call/hangup button based on active call state
        const actionBtnEl = document.createElement('button');
        actionBtnEl.style.marginRight = '10px';
        actionBtnEl.style.cursor = 'pointer';
        actionBtnEl.setAttribute('data-toggle', 'tooltip');
        actionBtnEl.setAttribute('data-placement', 'top');

        if (isInActiveCall) {
            // Show hang-up button only if in active call (user has answered)
            actionBtnEl.className = 'btn btn-custom btn-danger btn-m hangup-user-btn';
            actionBtnEl.innerHTML = '<i class="fas fa-phone-slash"></i>';
            actionBtnEl.title = t('room.hangupWith', { username: user });
            actionBtnEl.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!userSignedIn) return;
                console.log(`Hanging up call with ${user}`);
                // Send leave message to notify the other user
                sendMsg({ type: 'leave', name: connectedUser });
                handleLeave(false); // End call but stay in room
                renderUserList(); // Refresh the list to show call button again
            });
        } else {
            // Show call button if not in active call
            actionBtnEl.className = 'btn btn-custom btn-warning btn-m call-user-btn';
            actionBtnEl.innerHTML = '<i class="fas fa-phone"></i>';
            actionBtnEl.title = t('room.callUser', { username: user });
            actionBtnEl.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!userSignedIn) return;
                handleUserClickToCall(user);
            });
        }

        // Username span
        const nameSpan = document.createElement('span');
        nameSpan.textContent = user;

        // Send file button
        const sendFileBtn = document.createElement('button');
        sendFileBtn.className = 'btn btn-custom btn-secondary btn-m';
        sendFileBtn.innerHTML = '<i class="fas fa-paperclip"></i>';
        sendFileBtn.style.marginRight = '10px';
        sendFileBtn.style.cursor = 'pointer';
        sendFileBtn.setAttribute('data-toggle', 'tooltip');
        sendFileBtn.setAttribute('data-placement', 'top');
        sendFileBtn.title = t('file.sendToUser', { username: user });
        sendFileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!userSignedIn) return;

            if (!connectedUser || connectedUser !== user || !remoteVideo.srcObject) {
                toast(t('file.onlyUserInCall'), 'warning', 'top', 3000);
                return;
            }

            if (!dataChannel || dataChannel.readyState !== 'open') {
                toast(t('file.dataChannelNotReadyTryAgain'), 'warning', 'top', 3000);
                return;
            }

            pendingFileRecipient = user;
            if (fileInput) {
                fileInput.click();
            }
        });

        li.appendChild(actionBtnEl);
        li.appendChild(sendFileBtn);
        li.appendChild(nameSpan);

        li.addEventListener('click', () => {
            if (!userSignedIn) return;
            selectedUser = user;
            renderUserList();
        });
        li.addEventListener('keydown', (e) => {
            if (!userSignedIn) return;
            if (e.key === 'Enter') {
                const isInActiveCall =
                    connectedUser === user && remoteVideo.srcObject && remoteVideo.srcObject.getTracks().length > 0;
                if (isInActiveCall) {
                    // Send leave message to notify the other user
                    sendMsg({ type: 'leave', name: connectedUser });
                    handleLeave(false);
                    renderUserList();
                } else {
                    handleUserClickToCall(user);
                }
            }
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

// Tab switching function
function switchTab(tabName) {
    currentTab = tabName;

    // Update tab buttons
    if (usersTab && chatTab && settingsTab) {
        usersTab.classList.remove('active');
        chatTab.classList.remove('active');
        settingsTab.classList.remove('active');

        if (tabName === 'users') {
            usersTab.classList.add('active');
        } else if (tabName === 'chat') {
            chatTab.classList.add('active');
            // Clear unread messages when switching to chat
            unreadMessages = 0;
            updateChatNotification();
        } else if (tabName === 'settings') {
            settingsTab.classList.add('active');
            // Refresh devices when switching to settings
            refreshDevices(false);
        }
    }

    // Update tab content
    if (usersContent && chatContent && settingsContent) {
        usersContent.classList.remove('active');
        chatContent.classList.remove('active');
        settingsContent.classList.remove('active');

        if (tabName === 'users') {
            usersContent.classList.add('active');
        } else if (tabName === 'chat') {
            chatContent.classList.add('active');
        } else if (tabName === 'settings') {
            settingsContent.classList.add('active');
        }
    }
}

// Update chat notification badge
function updateChatNotification() {
    if (chatNotification) {
        if (unreadMessages > 0) {
            chatNotification.textContent = unreadMessages > 99 ? '99+' : unreadMessages.toString();
            chatNotification.classList.remove('hidden');
        } else {
            chatNotification.classList.add('hidden');
        }
    }
}

// Chat form handler
if (chatForm && chatInput) {
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (text.length > 0) {
            if (allConnectedUsers.length === 0) {
                toast(t('chat.cannotSendNoUsers'), 'warning', 'top', 2000);
                chatInput.value = '';
                return;
            }
            socket.emit('message', { type: 'chat', text });
            addChatMessage({ from: userName || t('chat.me'), text, timestamp: Date.now() }, true);
            chatInput.value = '';
        }
    });
}

function addChatMessage(msg, isSelf = false) {
    const div = document.createElement('div');
    div.className = 'chat-message';
    if (isSelf) {
        div.classList.add('own-message');
    }

    const userSpan = document.createElement('span');
    userSpan.className = 'chat-user';
    userSpan.textContent = isSelf ? t('chat.me') : msg.from;

    const textSpan = document.createElement('span');
    textSpan.className = 'chat-text';
    textSpan.textContent = ': ' + msg.text;

    const timeSpan = document.createElement('span');
    timeSpan.className = 'chat-time';
    timeSpan.textContent = formatChatTime(msg.timestamp);

    div.appendChild(userSpan);
    div.appendChild(textSpan);
    div.appendChild(timeSpan);
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Handle unread message counter
    if (!isSelf && currentTab !== 'chat') {
        unreadMessages++;
        updateChatNotification();

        // Show toast notification for new messages only if sidebar is not opened
        if (!userSidebar.classList.contains('active')) {
            toast(t('chat.newMessageFrom', { username: msg.from }), 'info', 'top', 2000);
        }
    }
}

// Add a file message entry into the chat with download link
function addFileMessageToChat({ from, name, size, url, isSelf }) {
    if (!chatMessages) return;

    const div = document.createElement('div');
    div.className = 'chat-message file-message';
    if (isSelf) {
        div.classList.add('own-message');
    }

    const userSpan = document.createElement('span');
    userSpan.className = 'chat-user';
    userSpan.textContent = isSelf ? t('chat.me') : from;

    const linkSpan = document.createElement('span');
    linkSpan.className = 'chat-text';

    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    const sizeKb = Math.max(1, Math.round(size / 1024));
    link.textContent = `${name} (${sizeKb} KB)`;
    linkSpan.appendChild(document.createTextNode(t('file.sentFileLabel')));
    linkSpan.appendChild(link);

    const timeSpan = document.createElement('span');
    timeSpan.className = 'chat-time';
    timeSpan.textContent = formatChatTime(Date.now());

    div.appendChild(userSpan);
    div.appendChild(linkSpan);
    div.appendChild(timeSpan);
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Handle unread message counter for received files
    if (!isSelf && currentTab !== 'chat') {
        unreadMessages++;
        updateChatNotification();

        if (!userSidebar.classList.contains('active')) {
            toast(t('file.newFileFrom', { username: from }), 'info', 'top', 2000);
        }
    }
}

// Render file transfer status UI (outgoing + incoming)
function renderFileTransferStatus() {
    if (!fileTransferStatusEl) return;

    fileTransferStatusEl.innerHTML = '';

    const anyTransfer = outgoingTransfer || incomingTransfer;
    if (!anyTransfer) {
        fileTransferStatusEl.style.display = 'none';
        return;
    }

    fileTransferStatusEl.style.display = 'block';

    if (outgoingTransfer) {
        const row = document.createElement('div');
        row.className = 'file-transfer-row outgoing';

        const info = document.createElement('div');
        info.className = 'file-transfer-info';

        const nameEl = document.createElement('div');
        nameEl.className = 'file-transfer-name';
        nameEl.textContent = t('file.sending', { filename: outgoingTransfer.name });

        const progressWrapper = document.createElement('div');
        progressWrapper.className = 'file-transfer-progress';
        const bar = document.createElement('div');
        bar.className = 'file-transfer-progress-bar';
        const percent = outgoingTransfer.size
            ? Math.min(100, Math.round((outgoingTransfer.sentBytes / outgoingTransfer.size) * 100))
            : 0;
        bar.style.width = percent + '%';
        progressWrapper.appendChild(bar);

        const meta = document.createElement('div');
        meta.className = 'file-transfer-meta';
        const sentKb = Math.round(outgoingTransfer.sentBytes / 1024);
        const totalKb = Math.round(outgoingTransfer.size / 1024);
        meta.textContent = `${sentKb}/${totalKb} KB (${percent}%)`;

        info.appendChild(nameEl);
        info.appendChild(progressWrapper);
        info.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'file-transfer-actions';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-sm btn-danger';
        cancelBtn.textContent = t('settings.cancel');
        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleOutgoingFileCancel();
        });
        actions.appendChild(cancelBtn);

        row.appendChild(info);
        row.appendChild(actions);
        fileTransferStatusEl.appendChild(row);
    }

    if (incomingTransfer) {
        const row = document.createElement('div');
        row.className = 'file-transfer-row incoming';

        const info = document.createElement('div');
        info.className = 'file-transfer-info';

        const nameEl = document.createElement('div');
        nameEl.className = 'file-transfer-name';
        nameEl.textContent = t('file.receiving', { filename: incomingTransfer.name });

        const progressWrapper = document.createElement('div');
        progressWrapper.className = 'file-transfer-progress';
        const bar = document.createElement('div');
        bar.className = 'file-transfer-progress-bar';
        const percent = incomingTransfer.size
            ? Math.min(100, Math.round((incomingTransfer.receivedBytes / incomingTransfer.size) * 100))
            : 0;
        bar.style.width = percent + '%';
        progressWrapper.appendChild(bar);

        const meta = document.createElement('div');
        meta.className = 'file-transfer-meta';
        const receivedKb = Math.round(incomingTransfer.receivedBytes / 1024);
        const totalKb = Math.round(incomingTransfer.size / 1024);
        meta.textContent = `${receivedKb}/${totalKb} KB (${percent}%)`;

        info.appendChild(nameEl);
        info.appendChild(progressWrapper);
        info.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'file-transfer-actions';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-sm btn-danger';
        cancelBtn.textContent = t('settings.cancel');
        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleIncomingFileCancel();
        });
        actions.appendChild(cancelBtn);

        row.appendChild(info);
        row.appendChild(actions);
        fileTransferStatusEl.appendChild(row);
    }
}

// Cancel outgoing file transfer (sender side)
function handleOutgoingFileCancel() {
    if (!outgoingTransfer) return;

    const id = outgoingTransfer.id;

    // Try to notify remote, but cancel locally even if this fails
    if (dataChannel && dataChannel.readyState === 'open') {
        try {
            dataChannel.send(
                JSON.stringify({
                    type: 'file-cancel',
                    id,
                    by: 'sender',
                })
            );
        } catch (e) {
            console.warn('Error sending cancel message over data channel', e);
        }
    }

    // Mark as cancelled; send loop will see this and stop
    outgoingTransfer.cancelled = true;
    toast(t('file.cancelled'), 'info', 'top', 3000);
}

// Cancel incoming file transfer (receiver side)
function handleIncomingFileCancel() {
    if (!incomingTransfer) return;

    const id = incomingTransfer.id;

    if (dataChannel && dataChannel.readyState === 'open') {
        try {
            dataChannel.send(
                JSON.stringify({
                    type: 'file-cancel',
                    id,
                    by: 'receiver',
                })
            );
        } catch (e) {
            console.warn('Error sending cancel message over data channel', e);
        }
    }

    incomingTransfer = null;
    incomingFileMeta = null;
    incomingFileData = null;
    incomingFileBuffers = [];
    incomingFileReceivedBytes = 0;
    toast(t('file.cancelled'), 'info', 'top', 3000);
    renderFileTransferStatus();
}

function formatChatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Handle emoji button click
function handleEmojiClick() {
    console.log('Emoji button clicked, current show state:', emojiPicker.classList.contains('show'));

    if (!emojiPicker.classList.contains('show')) {
        handleChatEmojiPicker();
        emojiPicker.classList.add('show');
        console.log('Emoji picker shown');
    } else {
        emojiPicker.classList.remove('show');
        console.log('Emoji picker hidden');
    }
}

// Initialize and handle chat emoji picker
function handleChatEmojiPicker() {
    // Clear any existing picker
    emojiPicker.innerHTML = '';

    console.log('Initializing EmojiMart picker...');

    const pickerOptions = {
        theme: 'dark',
        perLine: 8,
        onEmojiSelect: addEmojiToMsg,
    };

    const picker = new EmojiMart.Picker(pickerOptions);
    emojiPicker.appendChild(picker);

    console.log('EmojiMart picker initialized and appended');

    function addEmojiToMsg(data) {
        console.log('Emoji selected:', data.native);

        // Insert emoji at cursor position or at the end
        const cursorPosition = chatInput.selectionStart;
        const currentValue = chatInput.value;
        const newValue = currentValue.slice(0, cursorPosition) + data.native + currentValue.slice(cursorPosition);
        chatInput.value = newValue;

        // Set cursor position after the emoji
        const newCursorPosition = cursorPosition + data.native.length;
        chatInput.setSelectionRange(newCursorPosition, newCursorPosition);
        chatInput.focus();

        console.log('Emoji inserted into chat input at position:', cursorPosition);

        // Hide emoji picker after selection
        toggleChatEmoji();
    }
}

// Toggle chat emoji picker visibility
function toggleChatEmoji() {
    emojiPicker.classList.remove('show');
    console.log('Emoji picker hidden via toggle');
}

// Generate chat export text
function generateChatExportText() {
    const messages = chatMessages.children;

    if (messages.length === 0) {
        return null;
    }

    let chatText = '';
    const currentDate = new Date();
    const dateString = currentDate.toLocaleDateString();
    const timeString = currentDate.toLocaleTimeString();

    // Add header to the file
    chatText += `Call-me Chat Export\n`;
    chatText += `Exported on: ${dateString} at ${timeString}\n`;
    chatText += `Session participants: ${userName || 'Unknown'}, ${connectedUser || 'Unknown'}\n`;
    chatText += `${'='.repeat(50)}\n\n`;

    // Extract messages
    for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        const userSpan = message.querySelector('.chat-user');
        const textSpan = message.querySelector('.chat-text');
        const timeSpan = message.querySelector('.chat-time');

        if (userSpan && textSpan && timeSpan) {
            const user = userSpan.textContent;
            const text = textSpan.textContent.replace(': ', ''); // Remove the ': ' prefix
            const time = timeSpan.textContent;

            chatText += `[${time}] ${user}: ${text}\n`;
        }
    }

    return chatText;
}

// Download text as file
function downloadTextAsFile(text, filename) {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Handle save chat button click
function handleSaveChatClick() {
    const chatText = generateChatExportText();

    if (!chatText) {
        toast(t('chat.noMessagesToSave'), 'info', 'top', 2000);
        return;
    }

    const currentDate = new Date();
    const fileName = `call-me-chat-${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}-${String(currentDate.getHours()).padStart(2, '0')}${String(currentDate.getMinutes()).padStart(2, '0')}.txt`;

    downloadTextAsFile(chatText, fileName);

    toast(t('chat.savedAs', { filename: fileName }), 'success', 'top', 3000);
}

// Handle clear chat button click
function handleClearChatClick() {
    if (!thereAreChatMessages()) {
        toast(t('chat.noMessagesToClear'), 'info', 'top', 2000);
        return;
    }

    Swal.fire({
        heightAuto: false,
        scrollbarPadding: false,
        position: 'center',
        icon: 'question',
        title: t('chat.clearTitle'),
        text: t('chat.clearConfirm'),
        showCancelButton: true,
        confirmButtonText: t('chat.clearConfirmYes'),
        cancelButtonText: t('settings.cancel'),
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
    }).then((result) => {
        if (result.isConfirmed) {
            // Clear all chat messages
            chatMessages.innerHTML = '';

            // Reset unread messages counter
            unreadMessages = 0;
            updateChatNotification();

            // Show success message
            toast(t('chat.cleared'), 'success', 'top', 2000);
        }
    });
}

function thereAreChatMessages() {
    return chatMessages.children.length > 0;
}

// Device Management Functions
async function initializeDeviceSettings() {
    try {
        // Set initial device IDs from current stream
        if (stream) {
            const videoTrack = stream.getVideoTracks()[0];
            const audioTrack = stream.getAudioTracks()[0];

            if (videoTrack) {
                const videoSettings = videoTrack.getSettings();
                selectedDevices.videoInput = videoSettings.deviceId;
            }

            if (audioTrack) {
                const audioSettings = audioTrack.getSettings();
                selectedDevices.audioInput = audioSettings.deviceId;
            }
        }

        // Enumerate and populate device lists
        await enumerateDevices();
    } catch (error) {
        console.error('Error initializing device settings:', error);
    }
}

async function enumerateDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();

        availableDevices = {
            videoInputs: devices.filter((device) => device.kind === 'videoinput'),
            audioInputs: devices.filter((device) => device.kind === 'audioinput'),
            audioOutputs: devices.filter((device) => device.kind === 'audiooutput'),
        };

        populateDeviceSelects();
    } catch (error) {
        console.error('Error enumerating devices:', error);
        handleError(t('errors.mediaDevices'));
    }
}

function populateDeviceSelects() {
    // Populate video select
    if (videoSelect) {
        videoSelect.innerHTML = '';
        // Check if we actually have camera access by checking the stream
        const hasCamera = stream && stream.getVideoTracks().length > 0;

        if (!hasCamera) {
            videoSelect.innerHTML = `<option value="">${t('settings.noCamerasFound')}</option>`;
            videoSelect.disabled = true;
            videoSelect.parentElement.style.opacity = '0.5';
        } else {
            videoSelect.disabled = false;
            videoSelect.parentElement.style.opacity = '1';
            availableDevices.videoInputs.forEach((device) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `${t('settings.videoInput')} ${device.deviceId.slice(0, 8)}`;
                if (device.deviceId === selectedDevices.videoInput) {
                    option.selected = true;
                }
                videoSelect.appendChild(option);
            });
        }
    }

    // Populate audio input select
    if (audioSelect) {
        audioSelect.innerHTML = '';
        // Check if we actually have microphone access by checking the stream
        const hasMic = stream && stream.getAudioTracks().length > 0;

        if (!hasMic) {
            audioSelect.innerHTML = `<option value="">${t('settings.noMicrophonesFound')}</option>`;
            audioSelect.disabled = true;
            audioSelect.parentElement.style.opacity = '0.5';
        } else {
            audioSelect.disabled = false;
            audioSelect.parentElement.style.opacity = '1';
            availableDevices.audioInputs.forEach((device) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `${t('settings.audioInput')} ${device.deviceId.slice(0, 8)}`;
                if (device.deviceId === selectedDevices.audioInput) {
                    option.selected = true;
                }
                audioSelect.appendChild(option);
            });
        }
    }

    // Populate audio output select
    if (audioOutputSelect) {
        audioOutputSelect.innerHTML = '';
        if (availableDevices.audioOutputs.length === 0) {
            audioOutputSelect.innerHTML = `<option value="">${t('settings.noSpeakersFound')}</option>`;
        } else {
            availableDevices.audioOutputs.forEach((device) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `${t('settings.audioOutput')} ${device.deviceId.slice(0, 8)}`;
                if (device.deviceId === selectedDevices.audioOutput) {
                    option.selected = true;
                }
                audioOutputSelect.appendChild(option);
            });
        }
    }
}

// Update UI elements based on available devices
function updateUIForAvailableDevices() {
    const hasCamera = stream && stream.getVideoTracks().length > 0;
    const hasMic = stream && stream.getAudioTracks().length > 0;

    // Handle video button and local video
    if (!hasCamera) {
        if (videoBtn) {
            videoBtn.classList.add('btn-danger');
            videoBtn.disabled = true;
            videoBtn.style.opacity = '0.5';
            videoBtn.title = t('errors.noCameraAvailable');
        }
        if (swapCameraBtn) {
            swapCameraBtn.style.display = 'none';
        }
        if (localVideoContainer) {
            showCameraOffOverlay('local', true);
        }
    } else {
        if (videoBtn) {
            videoBtn.disabled = false;
            videoBtn.style.opacity = '1';
        }
    }

    // Handle audio button
    if (!hasMic) {
        if (audioBtn) {
            audioBtn.classList.add('btn-danger');
            audioBtn.disabled = true;
            audioBtn.style.opacity = '0.5';
            audioBtn.title = t('errors.noMicrophoneAvailable');
        }
    } else {
        if (audioBtn) {
            audioBtn.disabled = false;
            audioBtn.style.opacity = '1';
        }
    }
}

async function refreshDevices(showToast = true) {
    if (refreshDevicesBtn) {
        refreshDevicesBtn.disabled = true;
    }

    try {
        // Try to request permissions for available devices (don't fail if one is missing)
        try {
            await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (e) {
            // Try video only
            try {
                await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            } catch (videoError) {
                // Try audio only as fallback
                try {
                    await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                } catch (audioError) {
                    console.warn('No media devices available for permission request');
                }
            }
        }

        await enumerateDevices();
        updateUIForAvailableDevices();
        if (showToast) {
            toast(t('messages.devicesRefreshed'), 'success', 'top', 2000);
        }
    } catch (error) {
        console.error('Error refreshing devices:', error);
        handleError(t('errors.refreshDevicesFailed'));
    } finally {
        if (refreshDevicesBtn) {
            refreshDevicesBtn.disabled = false;
        }
    }
}

async function handleVideoDeviceChange() {
    const newDeviceId = videoSelect.value;
    if (newDeviceId && newDeviceId !== selectedDevices.videoInput) {
        selectedDevices.videoInput = newDeviceId;
        await updateVideoStream();
        updateUIForAvailableDevices();
        toast(t('messages.cameraChanged'), 'success', 'top', 2000);
    }
}

async function handleAudioDeviceChange() {
    const newDeviceId = audioSelect.value;
    if (newDeviceId && newDeviceId !== selectedDevices.audioInput) {
        selectedDevices.audioInput = newDeviceId;
        await updateAudioStream();
        updateUIForAvailableDevices();
        toast(t('messages.microphoneChanged'), 'success', 'top', 2000);
    }
}

async function handleAudioOutputDeviceChange() {
    const newDeviceId = audioOutputSelect.value;
    if (newDeviceId && newDeviceId !== selectedDevices.audioOutput) {
        selectedDevices.audioOutput = newDeviceId;
        await setAudioOutputDevice(newDeviceId);
        toast(t('messages.speakerChanged'), 'success', 'top', 2000);
    }
}

async function updateVideoStream() {
    try {
        const constraints = {
            video: { deviceId: selectedDevices.videoInput ? { exact: selectedDevices.videoInput } : true },
            audio: false,
        };

        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        const videoTrack = newStream.getVideoTracks()[0];

        if (!videoTrack) {
            throw new Error('No video track found in new stream');
        }

        // Preserve previous video enabled state
        let wasVideoEnabled = true;
        if (stream && stream.getVideoTracks().length > 0) {
            wasVideoEnabled = stream.getVideoTracks()[0].enabled;
        } else if (videoBtn && videoBtn.classList.contains('btn-danger')) {
            wasVideoEnabled = false;
        }
        // Apply preserved enabled state to new track
        videoTrack.enabled = wasVideoEnabled;

        // Update peer connection if it exists
        if (thisConnection) {
            const sender = thisConnection.getSenders().find((s) => s.track && s.track.kind === 'video');
            if (sender) {
                await sender.replaceTrack(videoTrack);
            } else {
                // If no sender exists, add the track
                thisConnection.addTrack(videoTrack, stream);
            }
        }

        // Update local video and stream
        if (stream) {
            const oldVideoTrack = stream.getVideoTracks()[0];
            if (oldVideoTrack) {
                stream.removeTrack(oldVideoTrack);
                oldVideoTrack.stop();
            }
            stream.addTrack(videoTrack);

            // Update local video element
            if (localVideo) {
                localVideo.srcObject = stream;
                handleVideoMirror(localVideo, stream);
            }

            // Reflect video state in UI and overlays
            if (wasVideoEnabled) {
                videoBtn && videoBtn.classList.remove('btn-danger');
                showCameraOffOverlay('local', false);
            } else {
                videoBtn && videoBtn.classList.add('btn-danger');
                showCameraOffOverlay('local', true);
            }

            // Notify server about media status change so remote user is aware
            sendMediaStatusToServer();
        }

        // Stop other tracks from the temporary stream
        newStream.getAudioTracks().forEach((track) => track.stop());
    } catch (error) {
        console.error('Error updating video stream:', error);
        handleError(t('errors.changeCameraFailed'));
    }
}

async function updateAudioStream() {
    try {
        const constraints = {
            video: false,
            audio: { deviceId: selectedDevices.audioInput ? { exact: selectedDevices.audioInput } : true },
        };

        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        const audioTrack = newStream.getAudioTracks()[0];

        if (!audioTrack) {
            throw new Error('No audio track found in new stream');
        }

        // Update peer connection if it exists
        if (thisConnection) {
            const sender = thisConnection.getSenders().find((s) => s.track && s.track.kind === 'audio');
            if (sender) {
                await sender.replaceTrack(audioTrack);
            } else {
                // If no sender exists, add the track
                thisConnection.addTrack(audioTrack, stream);
            }
        }

        // Update local stream
        if (stream) {
            const oldAudioTrack = stream.getAudioTracks()[0];
            if (oldAudioTrack) {
                stream.removeTrack(oldAudioTrack);
                oldAudioTrack.stop();
            }
            stream.addTrack(audioTrack);
        }

        // Stop other tracks from the temporary stream
        newStream.getVideoTracks().forEach((track) => track.stop());
    } catch (error) {
        console.error('Error updating audio stream:', error);
        handleError(t('errors.changeMicrophoneFailed'));
    }
}

async function setAudioOutputDevice(deviceId) {
    try {
        if (remoteVideo && typeof remoteVideo.setSinkId === 'function') {
            await remoteVideo.setSinkId(deviceId);
            selectedDevices.audioOutput = deviceId;
        } else {
            console.warn('Browser does not support audio output device selection');
            toast(t('errors.audioOutputNotSupported'), 'warning', 'top', 3000);
        }
    } catch (error) {
        console.error('Error setting audio output device:', error);
        handleError(t('errors.changeSpeakerFailed'));
    }
}

async function testDevices() {
    if (testDevicesBtn) {
        testDevicesBtn.disabled = true;
    }

    try {
        // Build constraints based on available devices
        const hasCamera = availableDevices.videoInputs.length > 0;
        const hasMic = availableDevices.audioInputs.length > 0;

        if (!hasCamera && !hasMic) {
            toast(t('errors.noDevicesToTest'), 'warning', 'top', 2000);
            return;
        }

        const constraints = {
            video: hasCamera
                ? selectedDevices.videoInput
                    ? { deviceId: { exact: selectedDevices.videoInput } }
                    : true
                : false,
            audio: hasMic
                ? selectedDevices.audioInput
                    ? { deviceId: { exact: selectedDevices.audioInput } }
                    : true
                : false,
        };

        const testStream = await navigator.mediaDevices.getUserMedia(constraints);

        // Log stream info for debugging
        console.log('Test stream tracks:', {
            video: testStream.getVideoTracks().length,
            audio: testStream.getAudioTracks().length,
            videoSettings: testStream.getVideoTracks()[0]?.getSettings(),
            audioSettings: testStream.getAudioTracks()[0]?.getSettings(),
        });

        // Test for 2 seconds then stop
        setTimeout(() => {
            testStream.getTracks().forEach((track) => track.stop());
            toast(t('messages.deviceTestCompleted'), 'success', 'top', 2000);
        }, 2000);
    } catch (error) {
        console.error('Error testing devices:', error);
        handleError(t('errors.deviceTestFailed', { message: error.message }));
    } finally {
        if (testDevicesBtn) {
            testDevicesBtn.disabled = false;
        }
    }
}

// Initialize devices when settings tab is accessed (not on page load)
// This prevents conflicts with initial stream setup

// Clean up before window close or reload
window.onbeforeunload = () => {
    handleLeaveClick();
};
