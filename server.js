const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/videoTracker', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// Video Schema
const videoSchema = new mongoose.Schema({
    id: Number,
    title: String,
    url: String,
    status: String,
    dateStarted: String,
    dateCompleted: String,
    duration: String,
    notes: String,
    lastModified: Date
});

const Video = mongoose.model('Video', videoSchema);

// API Routes
app.post('/api/videos/sync', async (req, res) => {
    try {
        const { videos, lastUpdated } = req.body;
        
        // Bulk upsert videos
        const operations = videos.map(video => ({
            updateOne: {
                filter: { id: video.id },
                update: { $set: video },
                upsert: true
            }
        }));

        await Video.bulkWrite(operations);

        // Get all videos from database (in case there are videos added from other devices)
        const allVideos = await Video.find({});
        
        res.json({
            success: true,
            videos: allVideos,
            message: 'Sync successful'
        });
    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/videos', async (req, res) => {
    try {
        const videos = await Video.find({});
        res.json(videos);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Serve the main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 