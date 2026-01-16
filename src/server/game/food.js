/**
 * Food Manager
 * Spawns and manages food dots on the map
 */

const { v4: uuidv4 } = require('uuid');

const FOOD_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#FFB6C1', '#87CEEB', '#98FB98', '#DDA0DD'
];

class FoodManager {
    constructor(worldWidth, worldHeight, targetFoodCount = 500) {
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        this.targetFoodCount = targetFoodCount;
        this.food = new Map();
    }

    initialize() {
        // Spawn initial food
        while (this.food.size < this.targetFoodCount) {
            this.spawnFood();
        }
    }

    spawnFood(x = null, y = null, value = 1, color = null) {
        const id = uuidv4();
        const margin = 50;

        const food = {
            id,
            x: x !== null ? x : margin + Math.random() * (this.worldWidth - margin * 2),
            y: y !== null ? y : margin + Math.random() * (this.worldHeight - margin * 2),
            value: value,
            color: color || FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)],
            radius: 5 + value * 2
        };

        this.food.set(id, food);
        return food;
    }

    // Add food from a dead snake
    addSnakeFood(foodArray) {
        for (const f of foodArray) {
            this.food.set(f.id, {
                ...f,
                radius: 5 + f.value * 2
            });
        }
    }

    removeFood(id) {
        return this.food.delete(id);
    }

    getFood(id) {
        return this.food.get(id);
    }

    // Replenish food to target count
    update() {
        while (this.food.size < this.targetFoodCount) {
            this.spawnFood();
        }
    }

    // Get all food as array
    toArray() {
        return Array.from(this.food.values());
    }

    // Get food near a position (for client culling)
    getNearby(x, y, radius) {
        const nearby = [];
        for (const food of this.food.values()) {
            const dx = food.x - x;
            const dy = food.y - y;
            if (dx * dx + dy * dy < radius * radius) {
                nearby.push(food);
            }
        }
        return nearby;
    }
}

module.exports = FoodManager;
