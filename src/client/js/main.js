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

    // Initialize UI
    ui = new UI(config);
    ui.onJoin = handleJoin;
    ui.onRespawn = handleRespawn;
    ui.onCashout = handleCashout;
    ui.onQuit = handleQuit;

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

function connectToServer(name, tierId, demoMode) {
    // Connect socket
    socket = io({
        transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
        console.log('[SOCKET] Connected:', socket.id);

        // Join game
        socket.emit('join', { name, tierId, demoMode });
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
    ui.showHome();
}

// Export for debugging
window.slither = {
    getSocket: () => socket,
    getGame: () => game,
    getConfig: () => config
};
