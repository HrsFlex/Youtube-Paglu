const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');
const https    = require('https');   // built-in — no API key needed

const app  = express();
const PORT = process.env.PORT || 3000;

const PLAYLIST_ID = 'PLxbwE86jKRgMpuZuLBivzlM8s2Dk5lXBQ';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// MongoDB (optional)
mongoose.connect('mongodb://localhost:27017/videoTracker', {
    useNewUrlParser: true, useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB connected');
}).catch(() => {
    console.log('MongoDB not available — using localStorage only');
});

const videoSchema = new mongoose.Schema({
    id: Number, title: String, url: String, status: String,
    dateStarted: String, dateCompleted: String, duration: String,
    notes: String, lastModified: Date
});
const Video = mongoose.model('Video', videoSchema);

// ─── Helper: fetch a URL and return body as string ────────────
function fetchPage(url) {
    return new Promise((resolve, reject) => {
        const opts = {
            headers: {
                'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        };
        https.get(url, opts, res => {
            // Follow redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchPage(res.headers.location).then(resolve).catch(reject);
            }
            let body = '';
            res.setEncoding('utf8');
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(body));
        }).on('error', reject);
    });
}

// ─── Playlist Proxy (no API key — scrapes ytInitialData) ──────
app.get('/api/playlist', async (req, res) => {
    try {
        console.log('Fetching CCNA playlist page…');
        const html = await fetchPage(`https://www.youtube.com/playlist?list=${PLAYLIST_ID}`);

        // YouTube embeds all playlist data as a JS variable in the page
        const match = html.match(/var ytInitialData = ({.+?});<\/script>/s);
        if (!match) throw new Error('Could not find ytInitialData in page');

        const data     = JSON.parse(match[1]);
        const contents = data?.contents
            ?.twoColumnBrowseResultsRenderer
            ?.tabs?.[0]?.tabRenderer?.content
            ?.sectionListRenderer?.contents?.[0]
            ?.itemSectionRenderer?.contents?.[0]
            ?.playlistVideoListRenderer?.contents || [];

        const items = contents
            .filter(c => c.playlistVideoRenderer)
            .map(c => {
                const v = c.playlistVideoRenderer;
                return {
                    title:    v.title?.runs?.[0]?.text     || 'Untitled',
                    videoId:  v.videoId,
                    duration: v.lengthText?.simpleText      || ''
                };
            });

        console.log(`Fetched ${items.length} videos`);
        res.json({ items, title: 'Free CCNA v1.1 200-301 | Complete Course 2026' });

    } catch (err) {
        console.error('Playlist scrape error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── Video Sync (MongoDB) ─────────────────────────────────────
app.post('/api/videos/sync', async (req, res) => {
    try {
        const { videos } = req.body;
        await Video.bulkWrite(videos.map(v => ({
            updateOne: { filter: { id: v.id }, update: { $set: v }, upsert: true }
        })));
        res.json({ success: true, videos: await Video.find({}) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/videos', async (req, res) => {
    try { res.json(await Video.find({})); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => {
    console.log(`✅  ILovePlaylist →  http://localhost:${PORT}`);
});