/**
 * SlitherStakes - Game Controller
 * Manages game loop, state, and rendering
 */

import Renderer from './render.js';
import Input from './input.js';

class Game {
    constructor(socket, joinData) {
        this.socket = socket;
        this.playerId = joinData.playerId;
        this.world = joinData.world;
        this.tier = joinData.tier;

        // Game state
        this.snakes = new Map();
        this.food = [];
        this.mySnake = null;
        this.alive = true;

        // Stats
        this.kills = 0;
        this.earnings = 0;

        // Canvas setup
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();

        // Camera
        this.camera = {
            x: joinData.snake.x,
            y: joinData.snake.y,
            zoom: 1
        };

        // Components
        this.renderer = new Renderer(this.ctx, this.world);
        this.input = new Input(this.canvas, this.camera, this);

        // Callbacks
        this.onDeath = null;
        this.onKill = null;

        // Frame timing
        this.lastTime = 0;
        this.animationFrame = null;

        // Bind methods
        this.loop = this.loop.bind(this);
        this.handleResize = this.handleResize.bind(this);

        // Event listeners
        window.addEventListener('resize', this.handleResize);

        // Add initial snake
        this.snakes.set(joinData.snake.id, joinData.snake);
        this.mySnake = joinData.snake;
    }

    resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Store logical (CSS) dimensions for coordinate calculations
        this.logicalWidth = width;
        this.logicalHeight = height;
        this.dpr = dpr;

        // Set canvas physical size (actual pixels)
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;

        // Set CSS display size
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';

        // Scale context to match DPR - use setTransform to reset first
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    handleResize() {
        this.resizeCanvas();
    }

    /**
     * Trigger haptic feedback on supported devices
     * @param {number|number[]} pattern - Vibration duration in ms, or pattern array [vibrate, pause, vibrate, ...]
     */
    vibrate(pattern) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    }

    start() {
        console.log('[GAME] Starting game loop');

        // Start input handling
        this.input.start();
        this.input.onMove = (target) => {
            this.socket.emit('input', target);
        };
        this.input.onBoost = (active) => {
            this.socket.emit('boost', { active });
            // Haptic feedback when boost starts
            if (active) {
                this.vibrate(30);
            }
        };

        // Start game loop
        this.lastTime = performance.now();
        this.loop();
    }

    stop() {
        console.log('[GAME] Stopping game loop');

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        this.input.stop();
        window.removeEventListener('resize', this.handleResize);
    }

    loop(currentTime = performance.now()) {
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Update
        this.update(deltaTime);

        // Render
        this.render();

        // Update HUD
        this.updateHUD();

        // Continue loop
        this.animationFrame = requestAnimationFrame(this.loop);
    }

    update(_deltaTime) {
        // Update camera to follow player
        if (this.mySnake && this.alive) {
            // Smooth camera follow
            const lerpFactor = 0.1;
            this.camera.x += (this.mySnake.x - this.camera.x) * lerpFactor;
            this.camera.y += (this.mySnake.y - this.camera.y) * lerpFactor;
        }

        // Interpolate snake positions (client-side prediction)
        for (const snake of this.snakes.values()) {
            if (snake.targetX !== undefined) {
                snake.x += (snake.targetX - snake.x) * 0.2;
                snake.y += (snake.targetY - snake.y) * 0.2;
            }
        }
    }

    render() {
        // Use logical dimensions for rendering calculations
        const width = this.logicalWidth || window.innerWidth;
        const height = this.logicalHeight || window.innerHeight;

        // Clear canvas
        this.ctx.fillStyle = '#0a0a15';
        this.ctx.fillRect(0, 0, width, height);

        // Apply camera transform
        this.ctx.save();
        this.ctx.translate(
            width / 2 - this.camera.x * this.camera.zoom,
            height / 2 - this.camera.y * this.camera.zoom
        );
        this.ctx.scale(this.camera.zoom, this.camera.zoom);

        // Render world
        this.renderer.renderGrid(this.camera);
        this.renderer.renderBorder();
        this.renderer.renderFood(this.food);
        this.renderer.renderSnakes(Array.from(this.snakes.values()), this.playerId);

        // Render touch indicator for mobile users
        this.renderer.renderTouchIndicator(this.ctx, this.input, this.mySnake, this.camera);

        this.ctx.restore();

        // Render minimap
        this.renderMinimap();
    }

    renderMinimap() {
        const minimapCanvas = document.getElementById('minimap-canvas');
        if (!minimapCanvas) return;

        const ctx = minimapCanvas.getContext('2d');
        const scale = minimapCanvas.width / this.world.width;

        // Clear
        ctx.fillStyle = '#0a0a15';
        ctx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);

        // Border
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, minimapCanvas.width, minimapCanvas.height);

        // Draw snakes as dots
        for (const snake of this.snakes.values()) {
            if (!snake.alive) continue;

            const x = snake.x * scale;
            const y = snake.y * scale;

            ctx.fillStyle = snake.id === this.playerId ? '#00ff88' : snake.color;
            ctx.beginPath();
            ctx.arc(x, y, snake.id === this.playerId ? 4 : 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Camera view rectangle
        if (this.mySnake) {
            const logicalWidth = this.logicalWidth || window.innerWidth;
            const logicalHeight = this.logicalHeight || window.innerHeight;
            const viewWidth = (logicalWidth / this.camera.zoom) * scale;
            const viewHeight = (logicalHeight / this.camera.zoom) * scale;
            const viewX = (this.camera.x - logicalWidth / 2 / this.camera.zoom) * scale;
            const viewY = (this.camera.y - logicalHeight / 2 / this.camera.zoom) * scale;

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.strokeRect(viewX, viewY, viewWidth, viewHeight);
        }
    }

    updateHUD() {
        const lengthEl = document.getElementById('hud-length');
        const killsEl = document.getElementById('hud-kills');
        const earningsEl = document.getElementById('hud-earnings');

        if (this.mySnake) {
            lengthEl.textContent = this.mySnake.length || 10;
            killsEl.textContent = this.mySnake.kills || 0;
            earningsEl.textContent = '$' + (this.mySnake.value || 0).toFixed(2);
        }
    }

    updateState(state) {
        // Update snakes
        const newSnakes = new Map();
        for (const snakeData of state.snakes) {
            const existing = this.snakes.get(snakeData.id);
            if (existing) {
                // Store target for interpolation
                snakeData.targetX = snakeData.x;
                snakeData.targetY = snakeData.y;
                snakeData.x = existing.x;
                snakeData.y = existing.y;
            }
            newSnakes.set(snakeData.id, snakeData);

            if (snakeData.id === this.playerId) {
                this.mySnake = snakeData;
            }
        }
        this.snakes = newSnakes;

        // Update food
        this.food = state.food;
    }

    handleDeath(data) {
        this.alive = false;

        // Haptic feedback for death (double buzz pattern)
        this.vibrate([100, 50, 100]);

        if (this.onDeath) {
            this.onDeath({
                killerName: data.killerName,
                length: this.mySnake?.length || 0,
                kills: this.mySnake?.kills || 0,
                earnings: this.mySnake?.value || 0
            });
        }
    }

    handleRespawn(data) {
        this.alive = true;
        this.mySnake = data.snake;
        this.snakes.set(data.snake.id, data.snake);
        this.camera.x = data.snake.x;
        this.camera.y = data.snake.y;
    }

    /**
     * Handle kill event with haptic feedback
     * @param {Object} data - Kill data from server
     */
    handleKill(data) {
        // Haptic feedback for kill (short buzz)
        this.vibrate(100);

        if (this.onKill) {
            this.onKill(data);
        }
    }
}

export default Game;
