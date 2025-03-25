const express = require('express');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// Start the server
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Set up Socket.io
const io = socketIO(server);

// Store connected users
const users = {};

io.on('connection', socket => {
    console.log(`New user connected: ${socket.id}`);
    
    // When a user joins
    socket.on('join', username => {
        users[socket.id] = username;
        socket.broadcast.emit('user-connected', socket.id);
    });
    
    // When a user disconnects
    socket.on('disconnect', () => {
        socket.broadcast.emit('user-disconnected', socket.id);
        delete users[socket.id];
    });
    
    // Signaling for WebRTC
    socket.on('signal', data => {
        io.to(data.target).emit('signal', {
            sender: socket.id,
            signal: data.signal
        });
    });
    
    // Offer to start a call
    socket.on('offer', (data) => {
        io.to(data.target).emit('offer', {
            sender: socket.id,
            offer: data.offer
        });
    });
    
    // Answer to an offer
    socket.on('answer', (data) => {
        io.to(data.target).emit('answer', {
            sender: socket.id,
            answer: data.answer
        });
    });
    
    // ICE candidates
    socket.on('ice-candidate', (data) => {
        io.to(data.target).emit('ice-candidate', {
            sender: socket.id,
            candidate: data.candidate
        });
    });
});
