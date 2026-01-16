/**
 * Room Manager
 * Manages multiple game rooms with Hathora integration
 */

const Room = require('./room');
const db = require('../database');

// Hathora integration (optional)
let HathoraCloud;
try {
    HathoraCloud = require('@hathora/cloud-sdk-typescript').HathoraCloud;
} catch (e) {
    console.log('[HATHORA] SDK not available, running in local mode');
}

const TICK_RATE = 60;
const TICK_INTERVAL = 1000 / TICK_RATE;

class RoomManager {
    constructor(io) {
        this.io = io;
        this.rooms = new Map(); // roomId -> Room
        this.playerRooms = new Map(); // socketId -> roomId
        this.tiers = new Map(); // tierId -> tier data

        // Hathora client (if configured)
        this.hathora = null;
        this.hathoraAppId = process.env.HATHORA_APP_ID;

        if (HathoraCloud && this.hathoraAppId && process.env.HATHORA_TOKEN) {
            this.hathora = new HathoraCloud({
                appId: this.hathoraAppId,
                security: {
                    hathoraDevToken: process.env.HATHORA_TOKEN
                }
            });
            console.log('[HATHORA] Initialized with app:', this.hathoraAppId);
        }

        this.gameLoopInterval = null;
    }

    async initialize() {
        // Load tiers from database
        const tiers = await db.getRoomTiers();
        for (const tier of tiers) {
            this.tiers.set(tier.id, tier);
        }
        console.log(`[ROOMS] Loaded ${tiers.length} room tiers`);
    }

    startGameLoop() {
        if (this.gameLoopInterval) return;

        this.gameLoopInterval = setInterval(() => {
            this.tick();
        }, TICK_INTERVAL);

        console.log(`[GAME] Loop started at ${TICK_RATE}Hz`);
    }

    stopGameLoop() {
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
        }
    }

    tick() {
        for (const [roomId, room] of this.rooms) {
            // Update game state
            const kills = room.update();

            // Broadcast kills
            for (const kill of kills) {
                this.io.to(roomId).emit('kill', kill);

                // Notify victim
                this.io.to(kill.victimId).emit('died', {
                    killerName: kill.killerName,
                    lostValue: kill.bounty
                });

                // Log kill to database
                db.logKill(roomId, kill.killerId, kill.killerName, kill.victimId, kill.victimName, kill.bounty);
            }

            // Broadcast state to all players in room (culled per player)
            for (const socketId of room.players.keys()) {
                const socket = this.io.sockets.sockets.get(socketId);
                if (socket) {
                    const state = room.getVisibleState(socketId);
                    socket.emit('state', state);
                }
            }

            // Broadcast leaderboard
            const leaderboard = room.getLeaderboard();
            this.io.to(roomId).emit('leaderboard', leaderboard);

            // Clean up empty rooms (except default rooms)
            if (room.playerCount === 0 && Date.now() - room.createdAt > 60000) {
                this.rooms.delete(roomId);
                console.log(`[ROOMS] Removed empty room: ${roomId}`);
            }
        }
    }

    async joinRoom(socket, name, tierId, demoMode = false) {
        // Get tier config
        let tier = this.tiers.get(tierId);
        if (!tier) {
            // Default to free tier
            tier = this.tiers.get(1) || { id: 1, name: 'Free', buy_in: 0, platform_fee: 0.20 };
        }

        // Find or create room for this tier
        let room = this.findAvailableRoom(tier.id);

        if (!room) {
            room = await this.createRoom(tier);
        }

        // Add player to room
        const result = room.addPlayer(socket.id, name, demoMode);

        // Track player's room
        this.playerRooms.set(socket.id, room.id);

        // Join socket.io room for broadcasts
        socket.join(room.id);

        // Log session to database
        db.logSession(room.id, socket.id, name, demoMode ? 0 : tier.buy_in);

        console.log(`[ROOMS] ${name} joined room ${room.id} (tier: ${tier.name}, players: ${room.playerCount})`);

        return {
            ...result,
            tier: {
                id: tier.id,
                name: tier.name,
                buyIn: tier.buy_in
            }
        };
    }

    findAvailableRoom(tierId) {
        for (const room of this.rooms.values()) {
            if (room.tier.id === tierId && room.playerCount < 50) {
                return room;
            }
        }
        return null;
    }

    async createRoom(tier) {
        const roomId = `room_${tier.id}_${Date.now()}`;

        // Create Hathora room if available
        let hathoraRoomId = null;
        if (this.hathora) {
            try {
                const hathoraRoom = await this.hathora.roomsV2.createRoom({
                    appId: this.hathoraAppId,
                    createRoomParams: {
                        region: 'Seattle',
                        roomConfig: JSON.stringify({
                            tierId: tier.id,
                            buyIn: tier.buy_in
                        })
                    }
                });
                hathoraRoomId = hathoraRoom.roomId;
                console.log(`[HATHORA] Created room: ${hathoraRoomId}`);
            } catch (error) {
                console.error('[HATHORA] Failed to create room:', error.message);
            }
        }

        const room = new Room(roomId, tier, this.io);
        this.rooms.set(roomId, room);

        // Log room to database
        db.createRoom(roomId, tier.id, hathoraRoomId);

        console.log(`[ROOMS] Created new room: ${roomId} (tier: ${tier.name})`);

        return room;
    }

    handleInput(socketId, data) {
        const roomId = this.playerRooms.get(socketId);
        if (!roomId) return;

        const room = this.rooms.get(roomId);
        if (room) {
            room.handleInput(socketId, data);
        }
    }

    handleBoost(socketId, active) {
        const roomId = this.playerRooms.get(socketId);
        if (!roomId) return;

        const room = this.rooms.get(roomId);
        if (room) {
            room.handleBoost(socketId, active);
        }
    }

    async respawnPlayer(socketId, demoMode = false) {
        const roomId = this.playerRooms.get(socketId);
        if (!roomId) return null;

        const room = this.rooms.get(roomId);
        if (!room) return null;

        return room.respawnPlayer(socketId);
    }

    async cashoutPlayer(socketId) {
        const roomId = this.playerRooms.get(socketId);
        if (!roomId) return { success: false, message: 'Not in a room' };

        const room = this.rooms.get(roomId);
        if (!room) return { success: false, message: 'Room not found' };

        const player = room.players.get(socketId);
        const snake = room.snakes.get(socketId);

        if (!player) return { success: false, message: 'Player not found' };

        // Calculate final earnings
        const earnings = player.earnings + (snake?.value || 0);

        // Remove from room
        room.removePlayer(socketId);
        this.playerRooms.delete(socketId);

        // Update database
        db.updateSessionCashout(socketId, earnings, player.kills);

        console.log(`[CASHOUT] ${player.name} cashed out: $${earnings.toFixed(2)} (${player.kills} kills)`);

        return {
            success: true,
            name: player.name,
            earnings,
            kills: player.kills,
            deaths: player.deaths,
            playTime: Date.now() - player.joinedAt
        };
    }

    removePlayer(socketId) {
        const roomId = this.playerRooms.get(socketId);
        if (!roomId) return;

        const room = this.rooms.get(roomId);
        if (room) {
            room.removePlayer(socketId);
        }

        this.playerRooms.delete(socketId);
    }

    getPublicRoomList() {
        const rooms = [];
        for (const [id, room] of this.rooms) {
            rooms.push({
                id,
                tier: room.tier.name,
                buyIn: room.tier.buy_in,
                playerCount: room.playerCount
            });
        }
        return rooms;
    }
}

module.exports = RoomManager;
