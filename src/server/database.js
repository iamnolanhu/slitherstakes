/**
 * Database Connection and Queries
 * PostgreSQL integration for SlitherStakes
 */

const { Pool } = require('pg');

// Database connection pool
let pool = null;

// Initialize database connection
async function initialize() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        console.log('[DATABASE] No DATABASE_URL set, running in memory-only mode');
        return false;
    }

    try {
        pool = new Pool({
            connectionString,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000
        });

        // Test connection
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();

        console.log('[DATABASE] PostgreSQL connected');
        return true;
    } catch (error) {
        console.error('[DATABASE] Connection failed:', error.message);
        console.log('[DATABASE] Running in memory-only mode');
        pool = null;
        return false;
    }
}

// Get room tiers
async function getRoomTiers() {
    if (!pool) {
        // Default tiers for memory mode
        return [
            { id: 1, name: 'Free', buy_in: 0, platform_fee: 0.20 },
            { id: 2, name: 'Micro', buy_in: 0.10, platform_fee: 0.20 },
            { id: 3, name: 'Low', buy_in: 0.50, platform_fee: 0.20 },
            { id: 4, name: 'Medium', buy_in: 1.00, platform_fee: 0.20 }
        ];
    }

    try {
        const result = await pool.query('SELECT * FROM room_tiers ORDER BY buy_in');
        return result.rows;
    } catch (error) {
        console.error('[DATABASE] getRoomTiers error:', error.message);
        return [
            { id: 1, name: 'Free', buy_in: 0, platform_fee: 0.20 }
        ];
    }
}

// Get tier by ID
async function getTierById(tierId) {
    if (!pool) {
        const tiers = await getRoomTiers();
        return tiers.find(t => t.id === tierId);
    }

    try {
        const result = await pool.query('SELECT * FROM room_tiers WHERE id = $1', [tierId]);
        return result.rows[0];
    } catch (error) {
        console.error('[DATABASE] getTierById error:', error.message);
        return null;
    }
}

// Create room record
async function createRoom(roomId, tierId, hathoraRoomId = null) {
    if (!pool) return null;

    try {
        const result = await pool.query(
            `INSERT INTO rooms (id, tier_id, hathora_room_id)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [roomId, tierId, hathoraRoomId]
        );
        return result.rows[0];
    } catch (error) {
        console.error('[DATABASE] createRoom error:', error.message);
        return null;
    }
}

// Log player session
async function logSession(roomId, socketId, name, buyIn) {
    if (!pool) return null;

    try {
        const result = await pool.query(
            `INSERT INTO room_sessions (room_id, socket_id, name, buy_in)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [roomId, socketId, name, buyIn]
        );
        return result.rows[0];
    } catch (error) {
        console.error('[DATABASE] logSession error:', error.message);
        return null;
    }
}

// Update session on cashout
async function updateSessionCashout(socketId, earnings, kills) {
    if (!pool) return null;

    try {
        const result = await pool.query(
            `UPDATE room_sessions
             SET earnings = $2, kills = $3, left_at = NOW()
             WHERE socket_id = $1 AND left_at IS NULL
             RETURNING *`,
            [socketId, earnings, kills]
        );
        return result.rows[0];
    } catch (error) {
        console.error('[DATABASE] updateSessionCashout error:', error.message);
        return null;
    }
}

// Log a kill
async function logKill(roomId, killerSocket, killerName, victimSocket, victimName, bounty) {
    if (!pool) return null;

    try {
        const result = await pool.query(
            `INSERT INTO kills (room_id, killer_socket, killer_name, victim_socket, victim_name, bounty)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [roomId, killerSocket || 'wall', killerName || 'the wall', victimSocket, victimName, bounty]
        );
        return result.rows[0];
    } catch (error) {
        console.error('[DATABASE] logKill error:', error.message);
        return null;
    }
}

// Get player stats
async function getPlayerStats(socketId) {
    if (!pool) return null;

    try {
        const result = await pool.query(
            `SELECT
                COUNT(*) as total_sessions,
                SUM(kills) as total_kills,
                SUM(deaths) as total_deaths,
                SUM(earnings) as total_earnings
             FROM room_sessions
             WHERE socket_id = $1`,
            [socketId]
        );
        return result.rows[0];
    } catch (error) {
        console.error('[DATABASE] getPlayerStats error:', error.message);
        return null;
    }
}

// Get recent kills for a room
async function getRecentKills(roomId, limit = 10) {
    if (!pool) return [];

    try {
        const result = await pool.query(
            `SELECT * FROM kills
             WHERE room_id = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [roomId, limit]
        );
        return result.rows;
    } catch (error) {
        console.error('[DATABASE] getRecentKills error:', error.message);
        return [];
    }
}

// Cleanup old sessions
async function cleanupOldSessions(hoursOld = 24) {
    if (!pool) return 0;

    try {
        const result = await pool.query(
            `DELETE FROM room_sessions
             WHERE left_at < NOW() - INTERVAL '${hoursOld} hours'`
        );
        return result.rowCount;
    } catch (error) {
        console.error('[DATABASE] cleanupOldSessions error:', error.message);
        return 0;
    }
}

module.exports = {
    initialize,
    getRoomTiers,
    getTierById,
    createRoom,
    logSession,
    updateSessionCashout,
    logKill,
    getPlayerStats,
    getRecentKills,
    cleanupOldSessions
};
