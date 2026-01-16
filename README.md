# SlitherStakes

Snake.io Battle Royale with micro-stakes kill bounties.

**Live Demo**: https://snake.ftwr.vip

## Features

- **Classic Snake.io Gameplay**: Smooth cursor-following movement with segment-based bodies
- **Kill Bounties**: Earn 80% of your victim's value when you kill them
- **Room Tiers**: Free, Micro ($0.10), Low ($0.50), Medium ($1.00) stakes
- **Cash Out Anytime**: Leave with your earnings whenever you want
- **Real-time Multiplayer**: Powered by Socket.io
- **Hathora Integration**: Distributed game rooms for global low-latency

## Tech Stack

- **Server**: Node.js + Express + Socket.io
- **Database**: PostgreSQL
- **Payments**: Flowglad
- **Hosting**: Hathora Cloud (optional)
- **Deployment**: Docker + Traefik

## Quick Start

```bash
# Install dependencies
npm install

# Development (with hot reload)
npm run watch

# Production build
npm run build

# Start server
npm start
```

## Environment Variables

```bash
# Required for payments (optional - runs in demo mode without)
FLOWGLAD_API_KEY=sk_live_xxx

# Optional - Hathora for distributed rooms
HATHORA_APP_ID=app_xxx
HATHORA_TOKEN=xxx

# Database (auto-configured in Docker)
DATABASE_URL=postgres://user:pass@host:5432/db
```

## Docker Deployment

```bash
# Build and run with Postgres
docker compose up -d --build

# View logs
docker compose logs -f slitherstakes
```

## How to Play

1. Enter your name
2. Select a tier (Free for practice, paid for real stakes)
3. Control your snake with the mouse cursor
4. Hold click or spacebar to boost (costs length)
5. Kill other snakes by making them hit your body
6. Earn 80% bounty on kills
7. Click "Cash Out" to leave with earnings

## Game Rules

- **Movement**: Your snake's head smoothly follows your cursor
- **Boost**: Hold click/space to move faster (shrinks your snake)
- **Kill**: If another snake's head hits YOUR body, they die
- **Death**: If YOUR head hits another snake's body, you die
- **Bounty**: Killer gets 80% of victim's accumulated value
- **Boundary**: Hitting the world edge kills you

## Architecture

```
slitherstakes/
├── src/
│   ├── server/           # Node.js server
│   │   ├── index.js      # Main entry
│   │   ├── game/         # Snake, Food, Collision
│   │   ├── rooms/        # Room management
│   │   └── economy/      # Flowglad payments
│   └── client/           # Browser client
│       ├── js/           # Game, Render, Input, UI
│       └── css/          # Styles
├── docker-compose.yml    # Postgres + App
└── init.sql             # Database schema
```

## API Endpoints

- `GET /api/config` - Game configuration
- `GET /api/rooms` - Active rooms list
- `POST /api/checkout` - Create payment session
- `GET /api/verify-payment/:id` - Verify payment

## Socket Events

### Client → Server
- `join { name, tierId, demoMode }` - Join a room
- `input { x, y }` - Mouse position
- `boost { active }` - Boost toggle
- `cashout` - Cash out and leave
- `respawn` - Respawn after death

### Server → Client
- `joined { playerId, snake, roomId, world }` - Joined room
- `state { snakes, food, timestamp }` - Game state (60Hz)
- `kill { killerName, victimName, bounty }` - Kill event
- `died { killerName }` - You died
- `cashout { earnings, kills, playTime }` - Cashout result

## License

MIT

## Credits

Built for the Flowglad + Hathora Hackathon 2026
