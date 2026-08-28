import dotenv from "dotenv";
import express from "express";
dotenv.config();

const PORT = process.env.PORT || 5000;

// Imported after dotenv.config() so the modules see the credentials.
const { runSyncSafely, startCalendarSyncLoop } = await import('./calendarSync.js');

const app = express();

app.get('/', (req, res) => {
    res.send("Testing")

});

// Health check for the uptime pinger that keeps a free Render instance awake.
app.get('/healthz', (req, res) => res.json({ ok: true }));

/**
 * Only callers holding SYNC_SECRET may trigger a sync. Without this an open
 * endpoint lets anyone burn through the Google API quota and rack up Firestore
 * writes. Skipped when the variable is unset, so local dev stays frictionless.
 */
function requireSyncSecret(req, res, next) {
    const secret = process.env.SYNC_SECRET;
    if (!secret) return next();

    const provided = req.get('x-sync-secret');
    if (provided !== secret) return res.status(401).json({ error: 'unauthorized' });
    next();
}

// Trigger a sync. Pass ?full=1 to ignore the stored syncToken and re-import
// everything from the last 30 days.
app.post('/api/sync/calendar', requireSyncSecret, async (req, res) => {
    try {
        const result = await runSyncSafely({ forceFullSync: req.query.full === '1' });
        res.json(result ?? { skipped: 'a sync is already running' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {

    console.log(`started the server on port ${PORT}`)

    // On hosts that suspend idle instances (Render's free tier), this interval
    // stops with the process — an external scheduler hitting the endpoint above
    // is what actually keeps the calendar in sync there.
    if (process.env.DISABLE_SYNC_LOOP !== '1') startCalendarSyncLoop();

});
