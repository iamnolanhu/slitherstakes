/**
 * Bot Player
 * AI-controlled snake for populating rooms
 */

const { v4: uuidv4 } = require('uuid');

const BOT_NAMES = [
    'Snek_Bot', 'AI_Slither', 'RoboWorm', 'ByteSnake', 'NPC_Steve',
    'Bot_Larry', 'CyberSnek', 'AutoPilot', 'SlitherAI', 'SnakeBot_9000',
    'Viper_AI', 'CobraBot', 'PythonNPC', 'RattleBot', 'MambaAI',
    'SerpentX', 'NoodleBot', 'WiggleAI', 'ScaleBot', 'HissBot'
];

// Bot difficulty settings
const BOT_THINK_INTERVAL = 10; // Ticks between AI decisions
const BOT_FOOD_SEEK_RADIUS = 300;
const BOT_DANGER_RADIUS = 150;
const BOT_WALL_MARGIN = 100;
const BOT_BOOST_CHANCE = 0.01;
const BOT_BOOST_COOLDOWN = 300; // Ticks

class BotPlayer {
    constructor(room) {
        this.id = `bot_${uuidv4().slice(0, 8)}`;
        this.name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
        this.room = room;
        this.isBot = true;

        // AI state
        this.targetAngle = Math.random() * Math.PI * 2;
        this.thinkTimer = Math.floor(Math.random() * BOT_THINK_INTERVAL); // Stagger thinking
        this.boostTimer = 0;
        this.boosting = false;

        // Behavior personality (adds variety)
        this.aggressiveness = Math.random(); // 0 = passive, 1 = aggressive
        this.foodPreference = 0.5 + Math.random() * 0.5; // How much they prioritize food
    }

    think(snakes, food, worldWidth, worldHeight) {
        this.thinkTimer++;
        if (this.thinkTimer < BOT_THINK_INTERVAL) return;
        this.thinkTimer = 0;

        const mySnake = snakes.get(this.id);
        if (!mySnake || !mySnake.alive) return;

        const headX = mySnake.x;
        const headY = mySnake.y;

        // Find nearest food
        let nearestFood = null;
        let nearestFoodDist = Infinity;
        const foodArray = Array.isArray(food) ? food : food.toArray();

        for (const f of foodArray) {
            const dist = Math.hypot(f.x - headX, f.y - headY);
            if (dist < nearestFoodDist) {
                nearestFoodDist = dist;
                nearestFood = f;
            }
        }

        // Find nearby danger (other snake heads)
        let nearestDanger = null;
        let nearestDangerDist = Infinity;

        for (const [id, snake] of snakes) {
            if (id === this.id || !snake.alive) continue;

            // Check distance to other snake's head
            const dist = Math.hypot(snake.x - headX, snake.y - headY);
            if (dist < nearestDangerDist && dist < BOT_DANGER_RADIUS) {
                // Only consider it danger if they're bigger or similar size
                if (snake.length >= mySnake.length * 0.8) {
                    nearestDangerDist = dist;
                    nearestDanger = snake;
                }
            }

            // Check distance to other snake's body (collision danger)
            for (const seg of snake.segments.slice(0, 10)) { // Check first 10 segments
                const segDist = Math.hypot(seg.x - headX, seg.y - headY);
                if (segDist < nearestDangerDist && segDist < BOT_DANGER_RADIUS) {
                    nearestDangerDist = segDist;
                    nearestDanger = { x: seg.x, y: seg.y, isBody: true };
                }
            }
        }

        // Priority 1: Avoid walls
        const wallAvoidance = this.calculateWallAvoidance(headX, headY, worldWidth, worldHeight);
        if (wallAvoidance) {
            this.targetAngle = wallAvoidance;
            this.boostTimer = 0; // Don't boost near walls
            return;
        }

        // Priority 2: Avoid danger
        if (nearestDanger && nearestDangerDist < BOT_DANGER_RADIUS) {
            // Flee from danger
            const fleeAngle = Math.atan2(headY - nearestDanger.y, headX - nearestDanger.x);
            this.targetAngle = fleeAngle;

            // Boost to escape if we have length
            if (mySnake.length > 15 && nearestDangerDist < 80) {
                this.boosting = true;
                setTimeout(() => { this.boosting = false; }, 300);
            }
            return;
        }

        // Priority 3: Seek food
        if (nearestFood && nearestFoodDist < BOT_FOOD_SEEK_RADIUS * this.foodPreference) {
            this.targetAngle = Math.atan2(nearestFood.y - headY, nearestFood.x - headX);
            return;
        }

        // Priority 4: Hunt smaller snakes (if aggressive)
        if (this.aggressiveness > 0.7) {
            let smallestPrey = null;
            let smallestPreyDist = Infinity;

            for (const [id, snake] of snakes) {
                if (id === this.id || !snake.alive) continue;
                if (snake.length < mySnake.length * 0.7) {
                    const dist = Math.hypot(snake.x - headX, snake.y - headY);
                    if (dist < smallestPreyDist && dist < 400) {
                        smallestPreyDist = dist;
                        smallestPrey = snake;
                    }
                }
            }

            if (smallestPrey) {
                // Aim ahead of where they're going
                const predictionTime = 10;
                const predictX = smallestPrey.x + Math.cos(smallestPrey.angle) * smallestPrey.speed * predictionTime;
                const predictY = smallestPrey.y + Math.sin(smallestPrey.angle) * smallestPrey.speed * predictionTime;
                this.targetAngle = Math.atan2(predictY - headY, predictX - headX);
                return;
            }
        }

        // Default: Random wandering with slight turns
        this.targetAngle += (Math.random() - 0.5) * 0.3;

        // Occasional boost
        this.boostTimer++;
        if (this.boostTimer > BOT_BOOST_COOLDOWN && Math.random() < BOT_BOOST_CHANCE) {
            this.boosting = true;
            this.boostTimer = 0;
            setTimeout(() => { this.boosting = false; }, 500);
        }
    }

    calculateWallAvoidance(x, y, worldWidth, worldHeight) {
        // Check if near any wall
        const margin = BOT_WALL_MARGIN;

        if (x < margin) {
            return 0; // Turn right (east)
        }
        if (x > worldWidth - margin) {
            return Math.PI; // Turn left (west)
        }
        if (y < margin) {
            return Math.PI / 2; // Turn down (south)
        }
        if (y > worldHeight - margin) {
            return -Math.PI / 2; // Turn up (north)
        }

        // Corner handling
        if (x < margin * 1.5 && y < margin * 1.5) {
            return Math.PI / 4; // Southeast
        }
        if (x < margin * 1.5 && y > worldHeight - margin * 1.5) {
            return -Math.PI / 4; // Northeast
        }
        if (x > worldWidth - margin * 1.5 && y < margin * 1.5) {
            return Math.PI * 3 / 4; // Southwest
        }
        if (x > worldWidth - margin * 1.5 && y > worldHeight - margin * 1.5) {
            return -Math.PI * 3 / 4; // Northwest
        }

        return null; // No wall avoidance needed
    }

    getInput() {
        return {
            angle: this.targetAngle,
            boost: this.boosting
        };
    }
}

module.exports = { BotPlayer, BOT_NAMES };
