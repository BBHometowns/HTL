const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // In production, replace with your actual domain
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Store active game rooms
const gameRooms = new Map();

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'HTL Server Running', rooms: gameRooms.size });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Host creates or joins a room
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

  // Host sends game state updates
  socket.on('updateGameState', ({ roomCode, gameState }) => {
    if (gameRooms.has(roomCode)) {
      gameRooms.get(roomCode).gameState = gameState;
      // Broadcast to all clients in the room except sender
      socket.to(roomCode).emit('gameStateUpdated', gameState);
    }
  });

  // Stream requests current game state
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
    // Clean up rooms
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

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`HTL Server running on port ${PORT}`);
});
