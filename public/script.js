const extractBtn = document.getElementById('extract-btn');
const downloadAllBtn = document.getElementById('download-all-btn');
const usernameInput = document.getElementById('username');
const limitInput = document.getElementById('limit');
const limitVal = document.getElementById('limit-val');
const resultsSection = document.getElementById('results-section');
const videoGrid = document.getElementById('video-grid');
const videoCount = document.getElementById('video-count');
const progressContainer = document.getElementById('progress-container');
const progressBarFill = document.getElementById('progress-bar-fill');
const progressText = document.getElementById('progress-text');
const btnText = extractBtn.querySelector('.btn-text');
const loader = extractBtn.querySelector('.loader');

let videosFound = [];

limitInput.addEventListener('input', () => {
    limitVal.textContent = limitInput.value;
});

extractBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim().replace('@', '');
    if (!username) {
        alert('Please enter a TikTok username');
        return;
    }

    // Reset UI
    setLoading(true);
    resultsSection.classList.add('hidden');
    progressContainer.classList.add('hidden');
    videoGrid.innerHTML = '';
    videosFound = [];

    try {
        const response = await fetch(`/api/scrape?username=${username}&limit=${limitInput.value}`);

        // Safe JSON parse — avoids crash if server returns HTML error page
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            throw new Error('Server error: yt-dlp may not be installed on the deployment server.');
        }

        const data = await response.json();

        if (data.error) throw new Error(data.error);

        videosFound = data.videos;
        videoCount.textContent = videosFound.length;

        if (videosFound.length > 0) {
            resultsSection.classList.remove('hidden');
            videosFound.forEach((url, index) => {
                const card = document.createElement('div');
                card.className = 'video-card';
                card.id = `video-${index}`;
                videoGrid.appendChild(card);
            });
        } else {
            alert('No videos found for this user.');
        }
    } catch (err) {
        console.error(err);
        alert('❌ Error: ' + err.message);
    } finally {
        setLoading(false);
    }
});

downloadAllBtn.addEventListener('click', async () => {
    if (videosFound.length === 0) return;

    progressContainer.classList.remove('hidden');
    downloadAllBtn.disabled = true;
    downloadAllBtn.style.opacity = '0.5';

    let completed = 0;
    const total = videosFound.length;
    const username = usernameInput.value.trim().replace('@', '');

    for (let i = 0; i < total; i++) {
        try {
            const response = await fetch('/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: videosFound[i] })
            });

            if (!response.ok) throw new Error('Server error');

            // Get video as blob and trigger browser download
            const blob = await response.blob();
            const videoId = videosFound[i].split('/').pop();
            const downloadUrl = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `tiktok_${videoId}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);

            completed++;
            updateProgress(completed, total);
            document.getElementById(`video-${i}`).classList.add('downloaded');

            // Small delay between downloads so browser doesn't block them
            await new Promise(r => setTimeout(r, 800));

        } catch (err) {
            console.error('Download failed for', videosFound[i], err);
        }
    }

    progressText.textContent = `✅ Done! ${completed} of ${total} videos saved to your Downloads.`;
    downloadAllBtn.disabled = false;
    downloadAllBtn.style.opacity = '1';
});

function setLoading(isLoading) {
    if (isLoading) {
        extractBtn.disabled = true;
        btnText.textContent = 'Scraping...';
        loader.classList.remove('hidden');
    } else {
        extractBtn.disabled = false;
        btnText.textContent = 'Extract Videos';
        loader.classList.add('hidden');
    }
}

function updateProgress(completed, total) {
    const percentage = (completed / total) * 100;
    progressBarFill.style.width = `${percentage}%`;
    progressText.textContent = `${completed} / ${total} Completed`;
}
