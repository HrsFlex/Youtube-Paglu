const https = require('https');

const PLAYLIST_ID = 'PLxbwE86jKRgMpuZuLBivzlM8s2Dk5lXBQ';

function fetchPage(url, redirects = 0) {
    if (redirects > 5) return Promise.reject(new Error('Too many redirects'));
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        }, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchPage(res.headers.location, redirects + 1).then(resolve).catch(reject);
            }
            let body = '';
            res.setEncoding('utf8');
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(body));
        }).on('error', reject);
    });
}

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const html = await fetchPage(`https://www.youtube.com/playlist?list=${PLAYLIST_ID}`);

        // YouTube embeds full playlist data as ytInitialData in the HTML
        const match = html.match(/var ytInitialData = ({.+?});<\/script>/s);
        if (!match) throw new Error('Could not find ytInitialData — YouTube may have changed their page structure');

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
                    title:    v.title?.runs?.[0]?.text   || 'Untitled',
                    videoId:  v.videoId,
                    duration: v.lengthText?.simpleText    || ''
                };
            });

        return res.status(200).json({
            items,
            title: 'Free CCNA v1.1 200-301 | Complete Course 2026',
            count: items.length
        });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
