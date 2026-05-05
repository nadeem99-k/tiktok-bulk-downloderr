const express = require('express');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
fs.ensureDirSync(DOWNLOAD_DIR);

app.get('/api/scrape', async (req, res) => {
    const { username, limit } = req.query;
    if (!username) return res.status(400).json({ error: 'Username is required' });

    const maxLimit = parseInt(limit) || 10;
    console.log(`Scraping up to ${maxLimit} videos for @${username} using yt-dlp...`);

    // Use yt-dlp to get video IDs which is much faster and doesn't need a browser
    // We use python -m yt_dlp to ensure we use the updated version
    const command = `python -m yt_dlp --get-id --flat-playlist --playlist-end ${maxLimit} https://www.tiktok.com/@${username}`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
            return res.status(500).json({ error: 'Failed to scrape videos. Make sure the username is correct and public.' });
        }
        
        const videoIds = stdout.trim().split(/\r?\n/).filter(id => id.length > 0);
        const videoUrls = videoIds.map(id => `https://www.tiktok.com/@${username}/video/${id}`);
        
        console.log(`Found ${videoUrls.length} videos.`);
        res.json({ videos: videoUrls });
    });
});

app.post('/api/download', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        const videoId = url.split('/').pop();

        console.log(`Fetching (No Watermark) ${url}...`);

        // Using TikWM API for watermark-free download
        const response = await axios.get(`https://www.tikwm.com/api/?url=${url}`);
        const videoData = response.data.data;

        if (!videoData || !videoData.play) {
            throw new Error('Could not find video play URL');
        }

        const videoStream = await axios({
            method: 'get',
            url: videoData.play,
            responseType: 'stream'
        });

        // Stream directly to browser — saves to user's Downloads/Gallery
        res.setHeader('Content-Disposition', `attachment; filename="tiktok_${videoId}.mp4"`);
        res.setHeader('Content-Type', 'video/mp4');
        console.log(`Streaming to browser: tiktok_${videoId}.mp4`);
        videoStream.data.pipe(res);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Download failed' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Using yt-dlp for scraping - No heavy Puppeteer required!`);
});
