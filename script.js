document.addEventListener("DOMContentLoaded", function () {
    const videoPlayer = document.getElementById("videoPlayer");
    const videoSource = document.getElementById("videoSource");
    const qualitySelect = document.getElementById("qualitySelect");

    qualitySelect.addEventListener("change", function () {
        let currentTime = videoPlayer.currentTime; // Get current playback position
        let isPlaying = !videoPlayer.paused; // Check if video is playing

        videoSource.src = this.value; // Change video source
        videoPlayer.load(); // Reload video

        videoPlayer.currentTime = currentTime; // Restore playback position

        if (isPlaying) {
            videoPlayer.play(); // Resume playing if it was playing before
        }
    });
});

document.addEventListener("DOMContentLoaded", () => {
    fetchUserLocation();
});

function fetchUserLocation() {
    fetch("https://ipinfo.io/json?token=AIzaSyDaR8y1O93HLeUIoIxUA2zfGokX9AWZ2Kg") // Replace with your API key
        .then(response => response.json())
        .then(data => {
            sessionStorage.setItem("userCity", data.city);
        })
        .catch(() => {
            sessionStorage.setItem("userCity", "Unknown City");
        });
}

function postComment() {
    const username = document.getElementById("username").value.trim();
    const commentText = document.getElementById("comment").value.trim();
    const userCity = sessionStorage.getItem("userCity") || "Unknown City";

    if (!username || !commentText) {
        alert("Please fill in all fields.");
        return;
    }

    if (containsSpecialCharacters(commentText)) {
        alert("Comments cannot contain special characters!");
        return;
    }

    if (containsBadWords(commentText)) {
        alert("Your comment contains inappropriate words!");
        return;
    }

    const commentSection = document.getElementById("comments-container");

    const commentBox = document.createElement("div");
    commentBox.className = "comment-box";
    commentBox.innerHTML = `
        <p><strong>${username} (${userCity}):</strong> <span class="comment-text">${commentText}</span></p>
        <div class="comment-actions">
            <span class="like" onclick="likeComment(this)">👍 <span>0</span></span>
            <span class="dislike" onclick="dislikeComment(this)">👎 <span>0</span></span>
            <span class="translate" onclick="translateComment(this, '${commentText}')">🌍 Translate</span>
        </div>
    `;

    commentSection.prepend(commentBox);
    document.getElementById("comment").value = "";
}

function likeComment(element) {
    let count = element.querySelector("span");
    count.textContent = parseInt(count.textContent) + 1;
}

function dislikeComment(element) {
    let count = element.querySelector("span");
    count.textContent = parseInt(count.textContent) + 1;

    if (parseInt(count.textContent) >= 2) {
        element.closest(".comment-box").remove();
    }
}

function containsSpecialCharacters(text) {
    const regex = /[!@#$%^&*(),.?":{}|<>]/g;
    return regex.test(text);
}

function containsBadWords(text) {
    const badWords = ["BAD", "WORST", "NOT GOOD", "VERY BAD"];
    return badWords.some(word => text.toLowerCase().includes(word));
}

function translateComment(element, originalText) {
    const targetLang = document.getElementById("language-select").value;

    detectLanguage(originalText, (detectedLang) => {
        // Ensure detectedLang is a valid 2-letter ISO code (fallback to 'en')
        if (!detectedLang || detectedLang.length !== 2) {
            detectedLang = "en";
        }

        const translateAPI = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalText)}&langpair=${detectedLang}|${targetLang}`;

        fetch(translateAPI)
            .then(response => response.json())
            .then(data => {
                if (data.responseData && data.responseData.translatedText) {
                    alert(`Translated: ${data.responseData.translatedText}`);
                } else {
                    alert("Translation failed. Please try again.");
                }
            })
            .catch(() => alert("Translation service unavailable."));
    });
}


function detectLanguage(text, callback) {
    const langDetectAPI = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|it`;

    fetch(langDetectAPI)
        .then(response => response.json())
        .then(data => {
            if (data.responseData && data.responseData.matches.length > 0) {
                let detectedLang = data.responseData.matches[0].segment; 
                console.log("Detected Language:", detectedLang); // Debugging
                callback(detectedLang);
            } else {
                callback("en"); // Default to English if detection fails
            }
        })
        .catch(() => callback("en"));
}

document.addEventListener("DOMContentLoaded", function () {
    const translateButtons = document.querySelectorAll(".translate");

    translateButtons.forEach(button => {
        button.addEventListener("click", function () {
            let dropdown = this.nextElementSibling;
            
            // Toggle active class to show/hide dropdown
            dropdown.classList.toggle("active");
        });
    });
});

 
// DOM elements
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const usersList = document.getElementById('users');
const usernameInput = document.getElementById('username');
const setUsernameBtn = document.getElementById('setUsername');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const shareScreenButton = document.getElementById('shareScreenButton');
const recordButton = document.getElementById('recordButton');
const stopRecordButton = document.getElementById('stopRecordButton');
const downloadButton = document.getElementById('downloadButton');
const youtubeUrlInput = document.getElementById('youtubeUrl');

// Variables
let localStream;
let remoteStream;
let peerConnection;
let currentCall = null;
let socket;
let username = '';
let mediaRecorder;
let recordedChunks = [];

// Configuration for the peer connection
const configuration = {
    iceServers: [
        {
            urls: [
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302'
            ]
        }
    ]
};

// Initialize the app
function init() {
    // Connect to Socket.io server
    socket = io();
    
    // Set up event listeners
    setUsernameBtn.addEventListener('click', setUsername);
    startButton.addEventListener('click', startCall);
    stopButton.addEventListener('click', stopCall);
    shareScreenButton.addEventListener('click', shareYouTube);
    recordButton.addEventListener('click', startRecording);
    stopRecordButton.addEventListener('click', stopRecording);
    downloadButton.addEventListener('click', downloadRecording);
    
    // Initially disable buttons
    disableCallControls(true);
    
    // Socket.io events
    socket.on('user-connected', userId => {
        addUserToList(userId);
    });
    
    socket.on('user-disconnected', userId => {
        removeUserFromList(userId);
        if (currentCall === userId) {
            stopCall();
        }
    });
    
    socket.on('offer', async data => {
        if (!peerConnection) {
            await createPeerConnection();
        }
        
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            socket.emit('answer', {
                target: data.sender,
                answer: answer
            });
            
            currentCall = data.sender;
            disableCallControls(false);
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    });
    
    socket.on('answer', async data => {
        if (peerConnection) {
            try {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                currentCall = data.sender;
            } catch (error) {
                console.error('Error handling answer:', error);
            }
        }
    });
    
    socket.on('ice-candidate', data => {
        if (peerConnection && data.candidate) {
            peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    });
}

// Set username and join chat
function setUsername() {
    username = usernameInput.value.trim();
    if (username) {
        socket.emit('join', username);
        usernameInput.disabled = true;
        setUsernameBtn.disabled = true;
    }
}

// Add user to the list
function addUserToList(userId) {
    if (userId !== socket.id) { // Don't add yourself
        const userItem = document.createElement('li');
        userItem.textContent = userId;
        userItem.dataset.id = userId;
        userItem.addEventListener('click', () => initiateCall(userId));
        usersList.appendChild(userItem);
    }
}

// Remove user from the list
function removeUserFromList(userId) {
    const userItem = document.querySelector(`li[data-id="${userId}"]`);
    if (userItem) {
        usersList.removeChild(userItem);
    }
}

// Initiate a call with another user
async function initiateCall(targetUserId) {
    if (!peerConnection) {
        await createPeerConnection();
    }
    
    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        socket.emit('offer', {
            target: targetUserId,
            offer: offer
        });
        
        currentCall = targetUserId;
        disableCallControls(false);
    } catch (error) {
        console.error('Error creating offer:', error);
    }
}

// Start a call
async function startCall() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        
        if (!peerConnection) {
            await createPeerConnection();
        }
        
        // Add local stream to connection
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
    } catch (error) {
        console.error('Error starting call:', error);
        alert('Error starting call: ' + error.message);
    }
}

// Create a peer connection
async function createPeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);
    
    // When remote stream arrives, show it in the remote video element
    peerConnection.ontrack = event => {
        remoteStream = event.streams[0];
        remoteVideo.srcObject = remoteStream;
    };
    
    // Handle ICE candidates
    peerConnection.onicecandidate = event => {
        if (event.candidate && currentCall) {
            socket.emit('ice-candidate', {
                target: currentCall,
                candidate: event.candidate
            });
        }
    };
    
    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === 'disconnected') {
            stopCall();
        }
    };
}

// Stop the call
function stopCall() {
    // Close all tracks in the local stream
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    
    // Close the peer connection
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    // Clear the video elements
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    
    // Reset call state
    currentCall = null;
    disableCallControls(true);
}

// Share YouTube screen
async function shareYouTube() {
    try {
        const youtubeUrl = youtubeUrlInput.value;
        if (!youtubeUrl) {
            alert('Please enter a YouTube URL first');
            return;
        }
        
        // First, try to share the entire screen
        let screenStream;
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always'
                },
                audio: false
            });
        } catch (error) {
            console.error('Error sharing screen:', error);
            alert('Could not share screen. Please make sure to select a window or tab.');
            return;
        }
        
        // Open YouTube in a new tab
        window.open(youtubeUrl, '_blank');
        
        // Replace the video track with the screen share
        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
        if (sender) {
            sender.replaceTrack(videoTrack);
        }
        
        // When the screen sharing stops, switch back to the camera
        videoTrack.onended = () => {
            const cameraTrack = localStream.getVideoTracks()[0];
            if (sender && cameraTrack) {
                sender.replaceTrack(cameraTrack);
            }
        };
        
    } catch (error) {
        console.error('Error sharing YouTube:', error);
        alert('Error sharing YouTube: ' + error.message);
    }
}

// Start recording
function startRecording() {
    if (!remoteStream) {
        alert('No remote video to record!');
        return;
    }
    
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(remoteStream);
    
    mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };
    
    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        downloadButton.onclick = () => {
            const a = document.createElement('a');
            a.href = url;
            a.download = `video-chat-recording-${new Date().toISOString()}.webm`;
            a.click();
        };
        downloadButton.disabled = false;
    };
    
    mediaRecorder.start();
    recordButton.disabled = true;
    stopRecordButton.disabled = false;
    alert('Recording started!');
}

// Stop recording
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        stopRecordButton.disabled = true;
        alert('Recording stopped!');
    }
}

// Download recording
function downloadRecording() {
    // This is handled in the onstop event of mediaRecorder
}

// Enable/disable call controls
function disableCallControls(disabled) {
    startButton.disabled = disabled;
    stopButton.disabled = !disabled;
    shareScreenButton.disabled = disabled;
    recordButton.disabled = disabled;
    stopRecordButton.disabled = true;
    downloadButton.disabled = true;
}

// Initialize the app when the page loads
    window.addEventListener('load', init);
    document.getElementById('stopButton').style.display = 'block';
    document.getElementById('stopButton').disabled = false;

