/**
 * SlitherStakes - Main Server Entry
 * Snake.io Battle Royale with micro-stakes kill bounties
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const RoomManager = require('./rooms/manager');
const flowglad = require('./economy/flowglad');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, '../client')));
app.use(express.json());

// Initialize room manager
const roomManager = new RoomManager(io);

// API Routes
app.get('/api/config', async (req, res) => {
    const config = flowglad.getConfig();
    const tiers = await db.getRoomTiers();
    res.json({ ...config, tiers });
});

app.get('/api/rooms', async (req, res) => {
    const rooms = roomManager.getPublicRoomList();
    res.json(rooms);
});

app.post('/api/checkout', async (req, res) => {
    const { playerId, playerName, tierId } = req.body;
    const tier = await db.getTierById(tierId);

    if (!tier || tier.buy_in === 0) {
        // Free tier - no payment needed
        return res.json({ success: true, demoMode: true });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const session = await flowglad.createCheckoutSession(
        playerId,
        playerName,
        `${baseUrl}/?payment=success&tier=${tierId}`,
        `${baseUrl}/?payment=cancelled`
    );

    if (!session) {
        return res.json({ success: true, demoMode: true });
    }

    res.json({ success: true, ...session });
});

app.get('/api/verify-payment/:sessionId', async (req, res) => {
    const verified = await flowglad.verifyPayment(req.params.sessionId);
    res.json({ verified });
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`[SOCKET] Player connected: ${socket.id}`);

    // Join a room by tier (optionally specify roomId)
    socket.on('join', async (data) => {
        const { name, tierId, demoMode, roomId } = data;
        console.log(`[SOCKET] ${name} joining tier ${tierId}${roomId ? ` (room: ${roomId})` : ''}`);

        try {
            const result = await roomManager.joinRoom(socket, name, tierId, demoMode, roomId);
            socket.emit('joined', result);
        } catch (error) {
            console.error('[SOCKET] Join error:', error);
            socket.emit('error', { message: error.message });
        }
    });

    // Player input (mouse position)
    socket.on('input', (data) => {
        roomManager.handleInput(socket.id, data);
    });

    // Boost toggle
    socket.on('boost', (data) => {
        roomManager.handleBoost(socket.id, data.active);
    });

    // Cash out and leave
    socket.on('cashout', async () => {
        const result = await roomManager.cashoutPlayer(socket.id);
        socket.emit('cashout', result);
    });

    // Leave room (no cashout, just disconnect)
    socket.on('leave', () => {
        roomManager.removePlayer(socket.id);
    });

    // Respawn after death
    socket.on('respawn', async (data) => {
        const result = await roomManager.respawnPlayer(socket.id, data.demoMode);
        if (result) {
            socket.emit('respawned', result);
        }
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log(`[SOCKET] Player disconnected: ${socket.id}`);
        roomManager.removePlayer(socket.id);
    });
});

// Initialize and start server
async function start() {
    console.log('[SERVER] Initializing SlitherStakes...');

    // Initialize database
    await db.initialize();
    console.log('[DATABASE] Connected');

    // Initialize Flowglad
    await flowglad.initializeProducts();
    console.log('[FLOWGLAD] Initialized');

    // Start game loop
    roomManager.startGameLoop();
    console.log('[GAME] Loop started');

    server.listen(PORT, () => {
        console.log(`[SERVER] SlitherStakes running on port ${PORT}`);
    });
}

start().catch(console.error);

module.exports = { app, server, io };
