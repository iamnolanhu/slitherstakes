/**
 * Collision Detection
 * Handles snake-to-snake and snake-to-food collisions
 */

class CollisionDetector {
    constructor() {
        // Cache for performance
        this.collisionCache = new Map();
    }

    // Check if a snake's head collides with another snake's body
    checkSnakeCollision(snake, otherSnakes) {
        if (!snake.alive) return null;

        const headX = snake.x;
        const headY = snake.y;
        const headRadius = snake.headRadius;

        for (const other of otherSnakes) {
            if (other.id === snake.id || !other.alive) continue;

            // Check collision with other snake's body segments
            // Skip the first few segments near their head (grace period)
            const segments = other.getBodyPositions();

            for (let i = 3; i < segments.length; i++) {
                const seg = segments[i];
                const dx = headX - seg.x;
                const dy = headY - seg.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = headRadius + seg.radius;

                if (dist < minDist) {
                    return {
                        killer: other,
                        victim: snake,
                        segment: i
                    };
                }
            }

            // Head-to-head collision - both die
            const otherHeadDx = headX - other.x;
            const otherHeadDy = headY - other.y;
            const otherHeadDist = Math.sqrt(otherHeadDx * otherHeadDx + otherHeadDy * otherHeadDy);
            const minHeadDist = headRadius + other.headRadius;

            if (otherHeadDist < minHeadDist * 0.8) {
                // Head-to-head: the longer snake survives, or both die if similar length
                if (Math.abs(snake.length - other.length) < 3) {
                    return {
                        killer: null, // Both die
                        victim: snake,
                        headToHead: true,
                        otherVictim: other
                    };
                } else if (snake.length < other.length) {
                    return {
                        killer: other,
                        victim: snake,
                        headToHead: true
                    };
                }
            }
        }

        return null;
    }

    // Check if snake head collides with food
    checkFoodCollision(snake, foodManager) {
        if (!snake.alive) return [];

        const headX = snake.x;
        const headY = snake.y;
        const headRadius = snake.headRadius;
        const eaten = [];

        // Get nearby food for efficiency
        const nearbyFood = foodManager.getNearby(headX, headY, headRadius + 20);

        for (const food of nearbyFood) {
            const dx = headX - food.x;
            const dy = headY - food.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < headRadius + food.radius) {
                eaten.push(food);
            }
        }

        return eaten;
    }

    // Check if point is inside world bounds
    isInBounds(x, y, worldWidth, worldHeight, margin = 0) {
        return x >= margin && x <= worldWidth - margin &&
               y >= margin && y <= worldHeight - margin;
    }

    // Calculate bounty for a kill (80% of victim's value)
    calculateBounty(victim, platformFee = 0.20) {
        const baseValue = victim.value || (victim.length * 0.01);
        return baseValue * (1 - platformFee);
    }
}

module.exports = new CollisionDetector();
