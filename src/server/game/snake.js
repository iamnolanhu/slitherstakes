/**
 * Snake Entity
 * Handles segment-based movement and growth
 */

const { v4: uuidv4 } = require('uuid');

// Constants
const SEGMENT_SPACING = 5;
const BASE_SPEED = 3;
const BOOST_SPEED = 6;
const _BOOST_MASS_COST = 0.5; // Mass lost per tick while boosting
const HEAD_RADIUS = 15;
const SEGMENT_RADIUS = 12;
const INITIAL_LENGTH = 10;
const MIN_LENGTH = 3;
const TURN_RATE_BASE = 0.15; // Radians per tick
const TURN_RATE_SCALE = 0.005; // Smaller = slower turn for longer snakes

class Snake {
    constructor(id, name, x, y, color) {
        this.id = id;
        this.name = name;
        this.color = color || this.randomColor();

        // Head position and angle
        this.x = x;
        this.y = y;
        this.angle = Math.random() * Math.PI * 2;

        // Target angle (where mouse is pointing)
        this.targetAngle = this.angle;

        // Body segments (each has x, y)
        this.segments = [];
        this.initializeSegments();

        // State
        this.alive = true;
        this.boosting = false;
        this.kills = 0;
        this.value = 0; // In-game value (for bounty calculation)

        // Stats
        this.maxLength = INITIAL_LENGTH;
        this.foodEaten = 0;
    }

    randomColor() {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
            '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
            '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    initializeSegments() {
        this.segments = [];
        for (let i = 0; i < INITIAL_LENGTH; i++) {
            this.segments.push({
                x: this.x - (i + 1) * SEGMENT_SPACING * Math.cos(this.angle),
                y: this.y - (i + 1) * SEGMENT_SPACING * Math.sin(this.angle)
            });
        }
    }

    get length() {
        return this.segments.length;
    }

    get headRadius() {
        return HEAD_RADIUS + Math.min(this.length * 0.1, 10);
    }

    get segmentRadius() {
        return SEGMENT_RADIUS + Math.min(this.length * 0.08, 8);
    }

    // Turn rate decreases as snake gets longer (harder to maneuver)
    get turnRate() {
        return Math.max(0.03, TURN_RATE_BASE - this.length * TURN_RATE_SCALE);
    }

    get speed() {
        const baseSpeed = this.boosting ? BOOST_SPEED : BASE_SPEED;
        // Slightly slower as snake grows
        return baseSpeed - Math.min(this.length * 0.01, 1);
    }

    setTarget(x, y) {
        // Calculate angle to target
        const dx = x - this.x;
        const dy = y - this.y;
        this.targetAngle = Math.atan2(dy, dx);
    }

    setBoost(active) {
        this.boosting = active && this.length > MIN_LENGTH;
    }

    update(worldWidth, worldHeight) {
        if (!this.alive) return;

        // Smoothly rotate towards target angle
        let angleDiff = this.targetAngle - this.angle;

        // Normalize angle difference to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // Apply turn rate
        if (Math.abs(angleDiff) > this.turnRate) {
            this.angle += Math.sign(angleDiff) * this.turnRate;
        } else {
            this.angle = this.targetAngle;
        }

        // Move head forward
        const _prevX = this.x;
        const _prevY = this.y;

        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;

        // World boundary collision
        const margin = this.headRadius;
        if (this.x < margin || this.x > worldWidth - margin ||
            this.y < margin || this.y > worldHeight - margin) {
            this.x = Math.max(margin, Math.min(worldWidth - margin, this.x));
            this.y = Math.max(margin, Math.min(worldHeight - margin, this.y));
        }

        // Update segments (follow the leader)
        let leaderX = this.x;
        let leaderY = this.y;

        for (let i = 0; i < this.segments.length; i++) {
            const seg = this.segments[i];
            const dx = leaderX - seg.x;
            const dy = leaderY - seg.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > SEGMENT_SPACING) {
                const ratio = SEGMENT_SPACING / dist;
                seg.x = leaderX - dx * ratio;
                seg.y = leaderY - dy * ratio;
            }

            leaderX = seg.x;
            leaderY = seg.y;
        }

        // Boosting costs mass
        if (this.boosting && this.length > MIN_LENGTH) {
            this.shrink(1);
        }
    }

    grow(amount = 1) {
        const lastSeg = this.segments[this.segments.length - 1] || { x: this.x, y: this.y };

        for (let i = 0; i < amount; i++) {
            this.segments.push({
                x: lastSeg.x,
                y: lastSeg.y
            });
        }

        this.maxLength = Math.max(this.maxLength, this.length);
        this.foodEaten += amount;
    }

    shrink(amount = 1) {
        for (let i = 0; i < amount && this.segments.length > MIN_LENGTH; i++) {
            this.segments.pop();
        }
    }

    die() {
        this.alive = false;
        this.boosting = false;
    }

    // Get positions of all segments for collision detection
    getBodyPositions() {
        return this.segments.map((seg, i) => ({
            x: seg.x,
            y: seg.y,
            radius: this.segmentRadius * (1 - i * 0.01) // Segments get slightly smaller towards tail
        }));
    }

    // Convert snake to food dots when it dies
    toFood() {
        const food = [];
        const foodPerSegment = 2;

        // Head drops more food
        for (let i = 0; i < 5; i++) {
            food.push({
                id: uuidv4(),
                x: this.x + (Math.random() - 0.5) * 30,
                y: this.y + (Math.random() - 0.5) * 30,
                value: 2,
                color: this.color
            });
        }

        // Each segment drops food
        for (const seg of this.segments) {
            for (let i = 0; i < foodPerSegment; i++) {
                food.push({
                    id: uuidv4(),
                    x: seg.x + (Math.random() - 0.5) * 20,
                    y: seg.y + (Math.random() - 0.5) * 20,
                    value: 1,
                    color: this.color
                });
            }
        }

        return food;
    }

    // Serialize for network transmission
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            color: this.color,
            x: this.x,
            y: this.y,
            angle: this.angle,
            segments: this.segments,
            length: this.length,
            alive: this.alive,
            boosting: this.boosting,
            kills: this.kills,
            value: this.value
        };
    }
}

module.exports = Snake;
