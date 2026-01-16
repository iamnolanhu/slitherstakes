/**
 * Game Room
 * Single room containing multiple players and game state
 */

const Snake = require('../game/snake');
const FoodManager = require('../game/food');
const collision = require('../game/collision');

// World configuration
const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 4000;
const FOOD_COUNT = 500;
const _TICK_RATE = 60;

class Room {
    constructor(id, tier, io) {
        this.id = id;
        this.tier = tier;
        this.io = io;

        // Game state
        this.snakes = new Map(); // socketId -> Snake
        this.players = new Map(); // socketId -> playerData
        this.food = new FoodManager(WORLD_WIDTH, WORLD_HEIGHT, FOOD_COUNT);

        // Room config
        this.worldWidth = WORLD_WIDTH;
        this.worldHeight = WORLD_HEIGHT;

        // Stats
        this.totalKills = 0;
        this.createdAt = Date.now();

        // Initialize food
        this.food.initialize();
    }

    get playerCount() {
        return this.snakes.size;
    }

    addPlayer(socketId, name, demoMode = false) {
        // Random spawn position
        const margin = 200;
        const x = margin + Math.random() * (this.worldWidth - margin * 2);
        const y = margin + Math.random() * (this.worldHeight - margin * 2);

        // Create snake
        const snake = new Snake(socketId, name, x, y);
        snake.value = demoMode ? 0 : this.tier.buy_in;

        this.snakes.set(socketId, snake);
        this.players.set(socketId, {
            name,
            socketId,
            demoMode,
            buyIn: demoMode ? 0 : this.tier.buy_in,
            earnings: 0,
            kills: 0,
            deaths: 0,
            joinedAt: Date.now()
        });

        return {
            playerId: socketId,
            snake: snake.toJSON(),
            roomId: this.id,
            world: {
                width: this.worldWidth,
                height: this.worldHeight
            }
        };
    }

    removePlayer(socketId) {
        const snake = this.snakes.get(socketId);
        const player = this.players.get(socketId);

        if (snake && snake.alive) {
            // Drop food when leaving
            const droppedFood = snake.toFood();
            this.food.addSnakeFood(droppedFood);
        }

        this.snakes.delete(socketId);
        this.players.delete(socketId);

        return player;
    }

    handleInput(socketId, data) {
        const snake = this.snakes.get(socketId);
        if (snake && snake.alive) {
            snake.setTarget(data.x, data.y);
        }
    }

    handleBoost(socketId, active) {
        const snake = this.snakes.get(socketId);
        if (snake && snake.alive) {
            snake.setBoost(active);
        }
    }

    respawnPlayer(socketId) {
        const player = this.players.get(socketId);
        if (!player) return null;

        // Remove old snake
        this.snakes.delete(socketId);

        // Create new snake
        const margin = 200;
        const x = margin + Math.random() * (this.worldWidth - margin * 2);
        const y = margin + Math.random() * (this.worldHeight - margin * 2);

        const snake = new Snake(socketId, player.name, x, y);
        snake.value = player.demoMode ? 0 : this.tier.buy_in;

        this.snakes.set(socketId, snake);

        return {
            snake: snake.toJSON()
        };
    }

    // Main game tick
    update() {
        const snakeArray = Array.from(this.snakes.values());
        const kills = [];

        // Update all snakes
        for (const snake of snakeArray) {
            if (!snake.alive) continue;

            snake.update(this.worldWidth, this.worldHeight);

            // Check collisions with other snakes
            const collisionResult = collision.checkSnakeCollision(snake, snakeArray);

            if (collisionResult) {
                if (collisionResult.headToHead && collisionResult.otherVictim) {
                    // Both die in head-to-head
                    this.handleDeath(collisionResult.victim, null);
                    this.handleDeath(collisionResult.otherVictim, null);
                } else if (collisionResult.killer) {
                    kills.push(this.handleDeath(collisionResult.victim, collisionResult.killer));
                }
            }

            // Check food collisions
            const eatenFood = collision.checkFoodCollision(snake, this.food);
            for (const food of eatenFood) {
                snake.grow(food.value);
                this.food.removeFood(food.id);
            }
        }

        // Replenish food
        this.food.update();

        return kills;
    }

    handleDeath(victim, killer) {
        victim.die();

        // Drop food from victim
        const droppedFood = victim.toFood();
        this.food.addSnakeFood(droppedFood);

        const victimPlayer = this.players.get(victim.id);
        if (victimPlayer) {
            victimPlayer.deaths++;
        }

        let bounty = 0;
        let killerName = 'the wall';

        if (killer) {
            bounty = collision.calculateBounty(victim, this.tier.platform_fee || 0.20);
            killer.kills++;
            killer.value += bounty;
            killerName = killer.name;

            const killerPlayer = this.players.get(killer.id);
            if (killerPlayer) {
                killerPlayer.kills++;
                killerPlayer.earnings += bounty;
            }

            this.totalKills++;
        }

        return {
            killerId: killer?.id,
            killerName,
            victimId: victim.id,
            victimName: victim.name,
            bounty,
            victimLength: victim.length
        };
    }

    // Get room state for clients
    getState() {
        return {
            snakes: Array.from(this.snakes.values())
                .filter(s => s.alive)
                .map(s => s.toJSON()),
            food: this.food.toArray(),
            timestamp: Date.now()
        };
    }

    // Get visible state for a specific player (culled)
    getVisibleState(socketId, viewRadius = 1000) {
        const playerSnake = this.snakes.get(socketId);
        if (!playerSnake) return this.getState();

        const px = playerSnake.x;
        const py = playerSnake.y;

        return {
            snakes: Array.from(this.snakes.values())
                .filter(s => {
                    if (!s.alive) return false;
                    const dx = s.x - px;
                    const dy = s.y - py;
                    return dx * dx + dy * dy < viewRadius * viewRadius * 1.5;
                })
                .map(s => s.toJSON()),
            food: this.food.getNearby(px, py, viewRadius),
            timestamp: Date.now()
        };
    }

    getLeaderboard(limit = 10) {
        return Array.from(this.snakes.values())
            .filter(s => s.alive)
            .sort((a, b) => b.length - a.length)
            .slice(0, limit)
            .map(s => ({
                name: s.name,
                length: s.length,
                kills: s.kills
            }));
    }
}

module.exports = Room;
