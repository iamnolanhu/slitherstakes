/**
 * SlitherStakes - UI Controller
 * Manages screens, modals, and HUD
 */

class UI {
    constructor(config) {
        this.config = config;

        // Screens
        this.homeScreen = document.getElementById('home-screen');
        this.lobbyScreen = document.getElementById('lobby-screen');
        this.gameScreen = document.getElementById('game-screen');

        // Modals
        this.deathModal = document.getElementById('death-modal');
        this.cashoutModal = document.getElementById('cashout-modal');

        // Input elements
        this.nameInput = document.getElementById('player-name');
        this.tierButtons = document.getElementById('tier-buttons');

        // Lobby elements
        this.roomList = document.getElementById('room-list');
        this.lobbyTabs = document.querySelectorAll('.lobby-tabs .tab-btn');

        // HUD elements
        this.leaderboardList = document.getElementById('leaderboard-list');
        this.killFeed = document.getElementById('kill-feed');

        // Callbacks
        this.onJoin = null;
        this.onRespawn = null;
        this.onCashout = null;
        this.onQuit = null;
        this.onShowLobby = null;
        this.onJoinRoom = null;
        this.onQuickPlay = null;

        // Initialize
        this.setupEventListeners();
        this.populateTiers();
        this.loadSavedName();
    }

    setupEventListeners() {
        // Tier buttons (set up after populating)

        // Game buttons
        document.getElementById('cashout-btn').addEventListener('click', () => {
            if (this.onCashout) this.onCashout();
        });

        // Death modal buttons
        document.getElementById('respawn-btn').addEventListener('click', () => {
            if (this.onRespawn) this.onRespawn();
        });

        document.getElementById('quit-btn').addEventListener('click', () => {
            this.hideDeathModal();
            if (this.onQuit) this.onQuit();
        });

        // Cashout modal button
        document.getElementById('home-btn').addEventListener('click', () => {
            this.hideCashoutModal();
            if (this.onQuit) this.onQuit();
        });

        // Enter key to join
        this.nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                // Join free tier by default
                this.joinTier(1, true);
            }
        });

        // Lobby tab buttons
        this.lobbyTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.lobbyTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const tier = tab.dataset.tier;
                if (this.onFilterRooms) {
                    this.onFilterRooms(tier);
                }
            });
        });

        // Quick Play button
        const quickPlayBtn = document.getElementById('quick-play-btn');
        if (quickPlayBtn) {
            quickPlayBtn.addEventListener('click', () => {
                if (this.onQuickPlay) this.onQuickPlay();
            });
        }

        // Back button
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.hideLobby();
                this.showHome();
            });
        }
    }

    populateTiers() {
        const tiers = this.config.tiers || [];

        this.tierButtons.innerHTML = '';

        for (const tier of tiers) {
            const btn = document.createElement('button');
            btn.className = 'tier-btn ' + tier.name.toLowerCase();
            btn.innerHTML = `
                ${tier.name}
                <span class="price">${tier.buy_in > 0 ? '$' + tier.buy_in.toFixed(2) : 'Free'}</span>
            `;

            btn.addEventListener('click', () => {
                this.joinTier(tier.id, tier.buy_in === 0);
            });

            this.tierButtons.appendChild(btn);
        }
    }

    loadSavedName() {
        const savedName = localStorage.getItem('slither_name');
        if (savedName) {
            this.nameInput.value = savedName;
        }
    }

    joinTier(tierId, demoMode) {
        const name = this.nameInput.value.trim() || 'Player';

        if (name.length < 1) {
            this.nameInput.focus();
            return;
        }

        if (this.onJoin) {
            this.onJoin(name, tierId, demoMode);
        }
    }

    showHome() {
        this.homeScreen.classList.add('active');
        this.lobbyScreen.classList.remove('active');
        this.gameScreen.classList.remove('active');
    }

    showLobby() {
        this.homeScreen.classList.remove('active');
        this.lobbyScreen.classList.add('active');
        this.gameScreen.classList.remove('active');
    }

    hideLobby() {
        this.lobbyScreen.classList.remove('active');
    }

    showGame() {
        this.homeScreen.classList.remove('active');
        this.lobbyScreen.classList.remove('active');
        this.gameScreen.classList.add('active');
    }

    renderRooms(rooms, filterTier = 'all') {
        if (!this.roomList) return;

        // Filter rooms by tier
        let filteredRooms = rooms;
        if (filterTier !== 'all') {
            const tierId = parseInt(filterTier);
            filteredRooms = rooms.filter(room => room.tierId === tierId);
        }

        // Clear and render
        this.roomList.innerHTML = '';

        if (filteredRooms.length === 0) {
            this.roomList.innerHTML = '<p class="no-rooms">No rooms available. Click Quick Play to create one!</p>';
            return;
        }

        for (const room of filteredRooms) {
            const tierInfo = this.config.tiers?.find(t => t.id === room.tierId) || { name: 'Unknown', buy_in: 0 };
            const card = document.createElement('div');
            card.className = 'room-card';
            card.innerHTML = `
                <div class="room-info">
                    <div class="room-tier">${this.escapeHtml(tierInfo.name)} Room</div>
                    <div class="room-players">${room.playerCount}/${room.maxPlayers} players</div>
                    <div class="room-buy-in">${tierInfo.buy_in > 0 ? '$' + tierInfo.buy_in.toFixed(2) : 'Free'}</div>
                </div>
                <button class="room-join-btn">Join</button>
            `;

            card.querySelector('.room-join-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.onJoinRoom) {
                    this.onJoinRoom(room.id, room.tierId);
                }
            });

            card.addEventListener('click', () => {
                if (this.onJoinRoom) {
                    this.onJoinRoom(room.id, room.tierId);
                }
            });

            this.roomList.appendChild(card);
        }
    }

    showDeathModal(data) {
        document.getElementById('killer-name').textContent = data.killerName || 'the wall';
        document.getElementById('death-length').textContent = data.length || 0;
        document.getElementById('death-kills').textContent = data.kills || 0;
        document.getElementById('death-earnings').textContent = '$' + (data.earnings || 0).toFixed(2);

        this.deathModal.classList.add('active');
    }

    hideDeathModal() {
        this.deathModal.classList.remove('active');
    }

    showCashoutModal(data) {
        document.getElementById('cashout-earnings').textContent = '$' + (data.earnings || 0).toFixed(2);
        document.getElementById('cashout-kills').textContent = data.kills || 0;

        // Format play time
        const seconds = Math.floor((data.playTime || 0) / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        document.getElementById('cashout-time').textContent =
            `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;

        this.cashoutModal.classList.add('active');
    }

    hideCashoutModal() {
        this.cashoutModal.classList.remove('active');
    }

    updateLeaderboard(leaderboard) {
        this.leaderboardList.innerHTML = '';

        for (let i = 0; i < leaderboard.length && i < 10; i++) {
            const entry = leaderboard[i];
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="name">${i + 1}. ${this.escapeHtml(entry.name)}</span>
                <span class="length">${entry.length}</span>
            `;
            this.leaderboardList.appendChild(li);
        }
    }

    addKillFeed(data) {
        const entry = document.createElement('div');
        entry.className = 'kill-entry';
        entry.innerHTML = `
            <span class="killer">${this.escapeHtml(data.killerName)}</span>
            killed
            <span class="victim">${this.escapeHtml(data.victimName)}</span>
            ${data.bounty > 0 ? `<span class="bounty">+$${data.bounty.toFixed(2)}</span>` : ''}
        `;

        this.killFeed.insertBefore(entry, this.killFeed.firstChild);

        // Limit kill feed entries
        while (this.killFeed.children.length > 5) {
            this.killFeed.removeChild(this.killFeed.lastChild);
        }

        // Auto-remove after delay
        setTimeout(() => {
            if (entry.parentNode) {
                entry.style.opacity = '0';
                setTimeout(() => entry.remove(), 300);
            }
        }, 5000);
    }

    showBountyPopup(amount) {
        const container = document.getElementById('bounty-popups');
        const popup = document.createElement('div');
        popup.className = 'bounty-popup';
        popup.textContent = `+$${amount.toFixed(2)}`;
        popup.style.left = '50%';
        popup.style.top = '40%';
        popup.style.transform = 'translateX(-50%)';

        container.appendChild(popup);

        // Remove after animation
        setTimeout(() => popup.remove(), 1500);
    }

    updateEarnings(earnings) {
        document.getElementById('hud-earnings').textContent = '$' + earnings.toFixed(2);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export default UI;
