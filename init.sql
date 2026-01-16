-- SlitherStakes Database Schema

-- Room tiers (stakes levels)
CREATE TABLE IF NOT EXISTS room_tiers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    buy_in DECIMAL(10,2) NOT NULL,
    platform_fee DECIMAL(5,4) DEFAULT 0.20,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO room_tiers (name, buy_in) VALUES
    ('Free', 0.00),
    ('Micro', 0.10),
    ('Low', 0.50),
    ('Medium', 1.00)
ON CONFLICT DO NOTHING;

-- Active rooms
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_id INTEGER REFERENCES room_tiers(id),
    name TEXT,
    player_count INTEGER DEFAULT 0,
    is_demo BOOLEAN DEFAULT FALSE,
    hathora_room_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player sessions within rooms
CREATE TABLE IF NOT EXISTS room_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    socket_id TEXT NOT NULL,
    name TEXT NOT NULL,
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    earnings DECIMAL(10,2) DEFAULT 0.00,
    buy_in DECIMAL(10,2) DEFAULT 0.00,
    snake_value DECIMAL(10,2) DEFAULT 0.00,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ
);

-- Kill log for analytics and bounty tracking
CREATE TABLE IF NOT EXISTS kills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    killer_socket TEXT NOT NULL,
    killer_name TEXT NOT NULL,
    victim_socket TEXT NOT NULL,
    victim_name TEXT NOT NULL,
    bounty DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment transactions
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES room_sessions(id),
    type TEXT NOT NULL CHECK (type IN ('buy_in', 'cashout', 'kill_bounty')),
    amount DECIMAL(10,2) NOT NULL,
    flowglad_session_id TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_room_sessions_room ON room_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_room_sessions_socket ON room_sessions(socket_id);
CREATE INDEX IF NOT EXISTS idx_kills_room ON kills(room_id);
CREATE INDEX IF NOT EXISTS idx_kills_created ON kills(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_session ON transactions(session_id);
