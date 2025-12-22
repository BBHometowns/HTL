const functions = require('firebase-functions');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Store active game rooms
const gameRooms = new Map();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'HTL Server Running', rooms: gameRooms.size });
});

// Create HTTP server and Socket.IO
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('createRoom', ({ roomCode, role }) => {
    socket.join(roomCode);
    
    if (!gameRooms.has(roomCode)) {
      gameRooms.set(roomCode, {
        host: socket.id,
        streams: [],
        gameState: null
      });
    }
    
    if (role === 'host') {
      gameRooms.get(roomCode).host = socket.id;
    } else if (role === 'stream') {
      gameRooms.get(roomCode).streams.push(socket.id);
    }
    
    socket.emit('roomJoined', { roomCode, role });
    console.log(`${role} joined room: ${roomCode}`);
  });
  
  socket.on('updateGameState', ({ roomCode, gameState }) => {
    if (gameRooms.has(roomCode)) {
      gameRooms.get(roomCode).gameState = gameState;
      socket.to(roomCode).emit('gameStateUpdated', gameState);
    }
  });
  
  socket.on('requestGameState', ({ roomCode }) => {
    if (gameRooms.has(roomCode)) {
      const room = gameRooms.get(roomCode);
      if (room.gameState) {
        socket.emit('gameStateUpdated', room.gameState);
      }
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    for (const [roomCode, room] of gameRooms.entries()) {
      if (room.host === socket.id) {
        gameRooms.delete(roomCode);
        console.log(`Room ${roomCode} deleted (host left)`);
      } else {
        room.streams = room.streams.filter(id => id !== socket.id);
      }
    }
  });
});

// Export the Express app wrapped in a Firebase Function
exports.api = functions.https.onRequest(app);

// Export Socket.IO as a separate function
exports.socketio = functions.https.onRequest((req, res) => {
  if (!req.path) {
    req.url = `/${req.url}`;
  }
  return server(req, res);
});/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
