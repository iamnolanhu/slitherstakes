/**
 * SlitherStakes - Main Client Entry Point
 */

import Game from './game.js';
import UI from './ui.js';

// Global state
let socket = null;
let game = null;
let ui = null;
let config = null;
let clerk = null;
let rooms = [];
let currentFilterTier = 'all';
let roomPollingInterval = null;

// Initialize on load
window.addEventListener('DOMContentLoaded', async () => {
    console.log('[SLITHER] Initializing SlitherStakes...');

    // Load config from server
    try {
        const response = await fetch('/api/config');
        config = await response.json();
        console.log('[SLITHER] Config loaded:', config);
    } catch (error) {
        console.error('[SLITHER] Failed to load config:', error);
        config = {
            platformFee: 0.20,
            bountyPercent: 0.80,
            demoMode: true,
            tiers: [
                { id: 1, name: 'Free', buy_in: 0 },
                { id: 2, name: 'Micro', buy_in: 0.10 }
            ]
        };
    }

    // Initialize Clerk (authentication)
    await initClerk();

    // Initialize UI
    ui = new UI(config);
    ui.onJoin = handleJoin;
    ui.onRespawn = handleRespawn;
    ui.onCashout = handleCashout;
    ui.onQuit = handleQuit;
    ui.onShowLobby = handleShowLobby;
    ui.onJoinRoom = handleJoinRoom;
    ui.onQuickPlay = handleQuickPlay;
    ui.onFilterRooms = handleFilterRooms;

    // Check for payment callback
    const params = new URLSearchParams(window.location.search);
    if (params.has('payment')) {
        const status = params.get('payment');
        const tierId = parseInt(params.get('tier') || '1');

        if (status === 'success') {
            console.log('[SLITHER] Payment successful, joining game...');
            // Clear URL params
            window.history.replaceState({}, '', '/');
            // Auto-join with payment
            const name = localStorage.getItem('slither_name') || 'Player';
            handleJoin(name, tierId, false);
        } else {
            console.log('[SLITHER] Payment cancelled');
            window.history.replaceState({}, '', '/');
        }
    }
});

// Initialize Clerk authentication
async function initClerk() {
    // Replace with your Clerk publishable key
    const CLERK_PUBLISHABLE_KEY = 'pk_test_c29saWQtbGlvbmZpc2gtNjguY2xlcmsuYWNjb3VudHMuZGV2JA';

    if (CLERK_PUBLISHABLE_KEY === 'CLERK_PUBLISHABLE_KEY_PLACEHOLDER') {
        console.log('[CLERK] No Clerk key configured, skipping authentication');
        return;
    }

    try {
        if (window.Clerk) {
            clerk = new window.Clerk(CLERK_PUBLISHABLE_KEY);
            await clerk.load();

            if (clerk.user) {
                console.log('[CLERK] User authenticated:', clerk.user.id);
                const userInfoEl = document.getElementById('user-info');
                const userNameEl = document.getElementById('user-name');
                const logoutBtn = document.getElementById('logout-btn');

                if (userInfoEl && userNameEl) {
                    userInfoEl.style.display = 'flex';
                    userNameEl.textContent = clerk.user.firstName ||
                        clerk.user.emailAddresses?.[0]?.emailAddress ||
                        'User';

                    // Pre-fill player name from Clerk user
                    const nameInput = document.getElementById('player-name');
                    if (nameInput && !nameInput.value) {
                        nameInput.value = clerk.user.firstName || '';
                    }
                }

                if (logoutBtn) {
                    logoutBtn.addEventListener('click', async () => {
                        await clerk.signOut();
                        window.location.reload();
                    });
                }
            } else {
                console.log('[CLERK] No user signed in');
            }
        }
    } catch (error) {
        console.error('[CLERK] Initialization error:', error);
    }
}

// Fetch rooms from server
async function fetchRooms() {
    try {
        const response = await fetch('/api/rooms');
        rooms = await response.json();
        console.log('[SLITHER] Fetched rooms:', rooms.length);
        if (ui) {
            ui.renderRooms(rooms, currentFilterTier);
        }
    } catch (error) {
        console.error('[SLITHER] Failed to fetch rooms:', error);
    }
}

// Start polling for room updates
function startRoomPolling() {
    if (roomPollingInterval) return;
    fetchRooms();
    roomPollingInterval = setInterval(fetchRooms, 5000);
    console.log('[SLITHER] Room polling started');
}

// Stop polling for room updates
function stopRoomPolling() {
    if (roomPollingInterval) {
        clearInterval(roomPollingInterval);
        roomPollingInterval = null;
        console.log('[SLITHER] Room polling stopped');
    }
}

// Handle showing lobby
function handleShowLobby() {
    ui.showLobby();
    startRoomPolling();
}

// Handle room filter change
function handleFilterRooms(tier) {
    currentFilterTier = tier;
    ui.renderRooms(rooms, currentFilterTier);
}

// Handle joining a specific room
function handleJoinRoom(roomId, tierId) {
    stopRoomPolling();
    const name = document.getElementById('player-name')?.value?.trim() || 'Player';
    localStorage.setItem('slither_name', name);

    // For now, join with demo mode (free play)
    const tier = config.tiers?.find(t => t.id === tierId);
    const demoMode = !tier || tier.buy_in === 0;

    connectToServer(name, tierId, demoMode, roomId);
}

// Handle quick play (auto-join best room)
function handleQuickPlay() {
    stopRoomPolling();
    const name = document.getElementById('player-name')?.value?.trim() ||
        localStorage.getItem('slither_name') || 'Player';
    localStorage.setItem('slither_name', name);

    // Join free tier by default
    connectToServer(name, 1, true);
}

// Handle join game
async function handleJoin(name, tierId, demoMode) {
    console.log(`[SLITHER] Joining as ${name}, tier ${tierId}, demo: ${demoMode}`);

    // Save name for next time
    localStorage.setItem('slither_name', name);

    // Check if payment needed
    const tier = config.tiers.find(t => t.id === tierId);
    if (tier && tier.buy_in > 0 && !demoMode) {
        // Redirect to payment
        try {
            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerId: 'pending',
                    playerName: name,
                    tierId
                })
            });
            const data = await response.json();

            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
                return;
            }
            // Fallback to demo mode
            demoMode = true;
        } catch (error) {
            console.error('[SLITHER] Checkout error:', error);
            demoMode = true;
        }
    }

    // Connect to server
    connectToServer(name, tierId, demoMode);
}

function connectToServer(name, tierId, demoMode, roomId = null) {
    // Connect socket
    socket = io({
        transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
        console.log('[SOCKET] Connected:', socket.id);

        // Join game (optionally with specific room)
        socket.emit('join', { name, tierId, demoMode, roomId });
    });

    socket.on('joined', (data) => {
        console.log('[SOCKET] Joined room:', data.roomId);

        // Initialize game
        game = new Game(socket, data);
        game.onDeath = handleDeath;
        game.onKill = handleKill;
        game.start();

        // Show game screen
        ui.showGame();
    });

    socket.on('state', (state) => {
        if (game) {
            game.updateState(state);
        }
    });

    socket.on('leaderboard', (leaderboard) => {
        ui.updateLeaderboard(leaderboard);
    });

    socket.on('kill', (data) => {
        ui.addKillFeed(data);
        if (data.killerId === socket.id) {
            ui.showBountyPopup(data.bounty);
            // Trigger haptic feedback via game controller
            if (game) {
                game.handleKill(data);
            }
        }
    });

    socket.on('died', (data) => {
        console.log('[SOCKET] Died:', data);
        if (game) {
            game.handleDeath(data);
        }
    });

    socket.on('respawned', (data) => {
        console.log('[SOCKET] Respawned');
        if (game) {
            game.handleRespawn(data);
        }
        ui.hideDeathModal();
    });

    socket.on('cashout', (data) => {
        console.log('[SOCKET] Cashed out:', data);
        ui.showCashoutModal(data);
    });

    socket.on('error', (data) => {
        console.error('[SOCKET] Error:', data.message);
        alert('Error: ' + data.message);
    });

    socket.on('disconnect', () => {
        console.log('[SOCKET] Disconnected');
        if (game) {
            game.stop();
            game = null;
        }
    });
}

function handleDeath(data) {
    ui.showDeathModal(data);
}

function handleKill(data) {
    // Update HUD with new earnings
    ui.updateEarnings(data.earnings);
}

function handleRespawn() {
    if (socket) {
        socket.emit('respawn', { demoMode: true });
    }
}

function handleCashout() {
    if (socket) {
        socket.emit('cashout');
    }
}

function handleQuit() {
    if (socket) {
        socket.disconnect();
    }
    if (game) {
        game.stop();
        game = null;
    }
    stopRoomPolling();
    ui.showHome();
}

// Export for debugging
window.slither = {
    getSocket: () => socket,
    getGame: () => game,
    getConfig: () => config,
    getClerk: () => clerk,
    getRooms: () => rooms,
    showLobby: () => handleShowLobby()
};
