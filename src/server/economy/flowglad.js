/**
 * Flowglad Payment Integration for SlitherStakes
 * Handles buy-ins, kill bounties, and cashouts
 */

const { Flowglad } = require('@flowglad/node');

// Initialize Flowglad client
const flowglad = new Flowglad({
    apiKey: process.env.FLOWGLAD_API_KEY || 'sk_test_demo'
});

// Platform fee (20% goes to platform, 80% to killer bounties)
const PLATFORM_FEE_PERCENT = 0.20;

// Cache for price IDs
let priceCache = new Map();

/**
 * Initialize and find available prices
 */
async function initializeProducts() {
    try {
        console.log('[FLOWGLAD] Initializing payment products...');

        const pricesResponse = await flowglad.prices.list();

        if (pricesResponse.data && pricesResponse.data.length > 0) {
            for (const price of pricesResponse.data) {
                const amount = price.unitPrice / 100;
                priceCache.set(amount, price.id);
                console.log(`[FLOWGLAD] Found price: $${amount.toFixed(2)} -> ${price.id}`);
            }
            return true;
        }

        console.log('[FLOWGLAD] No prices found. Running in demo mode.');
        return false;
    } catch (error) {
        console.error('[FLOWGLAD] Initialization error:', error.message);
        console.log('[FLOWGLAD] Running in demo mode (simulated payments)');
        return false;
    }
}

/**
 * Create checkout session for room buy-in
 */
async function createCheckoutSession(playerId, playerName, successUrl, cancelUrl) {
    try {
        // Find a suitable price (any will do for demo)
        const priceId = priceCache.values().next().value;

        if (!priceId) {
            console.log('[FLOWGLAD] Demo mode - no checkout created');
            return null;
        }

        console.log(`[FLOWGLAD] Creating checkout for ${playerName}`);

        const sessionResponse = await flowglad.checkoutSessions.create({
            checkoutSession: {
                type: 'product',
                anonymous: true,
                priceId: priceId,
                successUrl: successUrl,
                cancelUrl: cancelUrl,
                outputName: `${playerName} - SlitherStakes Buy-in`,
                outputMetadata: {
                    playerId,
                    playerName,
                    game: 'slitherstakes'
                }
            }
        });

        console.log(`[FLOWGLAD] Checkout created: ${sessionResponse.checkoutSession.id}`);

        return {
            checkoutUrl: sessionResponse.url,
            sessionId: sessionResponse.checkoutSession.id
        };
    } catch (error) {
        console.error('[FLOWGLAD] Checkout error:', error.message);
        return null;
    }
}

/**
 * Verify payment was successful
 */
async function verifyPayment(sessionId) {
    try {
        const response = await flowglad.checkoutSessions.retrieve(sessionId);
        return response.checkoutSession.status === 'succeeded';
    } catch (error) {
        console.error('[FLOWGLAD] Verify error:', error.message);
        return false;
    }
}

/**
 * Calculate bounty for a kill
 * Bounty = victim's value * (1 - platform fee)
 */
function calculateBounty(victimValue) {
    return victimValue * (1 - PLATFORM_FEE_PERCENT);
}

/**
 * Check if real payments are configured
 */
function isConfigured() {
    return priceCache.size > 0;
}

/**
 * Get config for client display
 */
function getConfig() {
    return {
        platformFee: PLATFORM_FEE_PERCENT,
        bountyPercent: 1 - PLATFORM_FEE_PERCENT,
        isConfigured: isConfigured(),
        demoMode: !isConfigured()
    };
}

module.exports = {
    initializeProducts,
    createCheckoutSession,
    verifyPayment,
    calculateBounty,
    isConfigured,
    getConfig,
    flowglad
};
