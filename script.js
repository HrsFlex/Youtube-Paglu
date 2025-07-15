let videoData = [];
let currentFetchMethod = '';
let fetchController = null;

// Data persistence functions
function saveToLocalStorage() {
    localStorage.setItem('videoTrackerData', JSON.stringify(videoData));
    localStorage.setItem('lastUpdated', new Date().toISOString());
}

function loadFromLocalStorage() {
    const savedData = localStorage.getItem('videoTrackerData');
    if (savedData) {
        videoData = JSON.parse(savedData);
        // Clear existing table
        document.getElementById('videoTableBody').innerHTML = '';
        // Populate table with saved data
        videoData.forEach((video, index) => {
            addVideoToTable(video, index + 1);
        });
        updateStats();
    }
}

// Database integration functions (to be implemented with backend)
async function syncWithDatabase() {
    try {
        const response = await fetch('/api/videos/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                videos: videoData,
                lastUpdated: localStorage.getItem('lastUpdated')
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to sync with database');
        }

        const result = await response.json();
        console.log('Synced with database:', result);
    } catch (error) {
        console.error('Error syncing with database:', error);
        // Handle error (show user notification, retry, etc.)
    }
}

function updateStats() {
    const total = videoData.length;
    const completed = videoData.filter(v => v.status === 'completed').length;
    const inProgress = videoData.filter(v => v.status === 'in-progress').length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    document.getElementById('totalVideos').textContent = total;
    document.getElementById('completedVideos').textContent = completed;
    document.getElementById('inProgressVideos').textContent = inProgress;
    document.getElementById('progressPercentage').textContent = percentage + '%';
    document.getElementById('progressFill').style.width = percentage + '%';
}

function addVideo() {
    document.getElementById('addVideoModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('addVideoModal').style.display = 'none';
    document.getElementById('videoTitle').value = '';
    document.getElementById('videoUrl').value = '';
    document.getElementById('videoDuration').value = '';
}

function saveVideo() {
    const title = document.getElementById('videoTitle').value;
    const url = document.getElementById('videoUrl').value;
    const duration = document.getElementById('videoDuration').value;

    if (!title) {
        alert('Please enter a video title');
        return;
    }

    const newVideo = {
        id: Date.now(),
        title: title,
        url: url || '#',
        status: 'not-started',
        dateStarted: '',
        dateCompleted: '',
        duration: duration,
        notes: '',
        lastModified: new Date().toISOString()
    };

    videoData.push(newVideo);
    addVideoToTable(newVideo, videoData.length);
    updateStats();
    saveToLocalStorage(); // Save after adding new video
    closeModal();
}

// Auto-Fetch Functions
function showFetchModal() {
    document.getElementById('fetchModal').style.display = 'block';
}

function closeFetchModal() {
    document.getElementById('fetchModal').style.display = 'none';
    currentFetchMethod = '';
    document.getElementById('fetchInputs').innerHTML = '';
    document.getElementById('fetchButton').disabled = true;
    document.querySelectorAll('.fetch-option').forEach(opt => opt.classList.remove('selected'));
}

function selectFetchMethod(method) {
    currentFetchMethod = method;
    document.querySelectorAll('.fetch-option').forEach(opt => opt.classList.remove('selected'));
    document.querySelector(`[onclick="selectFetchMethod('${method}')"]`).classList.add('selected');
    document.getElementById('fetchButton').disabled = false;
    
    const inputsDiv = document.getElementById('fetchInputs');
    
    if (method === 'api') {
        inputsDiv.innerHTML = `
            <div class="form-group">
                <label>YouTube Playlist URL:</label>
                <input type="url" id="playlistUrl" placeholder="https://www.youtube.com/playlist?list=..." required>
            </div>
            <div class="form-group">
                <label>YouTube Data API Key:</label>
                <input type="text" id="apiKey" placeholder="Enter your API key" required>
                <small style="color: #666; display: block; margin-top: 5px;">
                    <a href="https://console.developers.google.com/" target="_blank" style="color: #667eea;">Get your free API key here</a>
                </small>
            </div>
        `;
    }
    /* Commented out web scraping and bookmarklet options
    else if (method === 'scraper') {
        inputsDiv.innerHTML = `
            <div class="form-group">
                <label>YouTube Playlist URL:</label>
                <input type="url" id="playlistUrl" placeholder="https://www.youtube.com/playlist?list=..." required>
            </div>
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 10px; margin: 10px 0;">
                <small style="color: #856404;">
                    <strong>Note:</strong> This method may be slower and could be blocked by YouTube's anti-bot measures. 
                    For best results, use the API method.
                </small>
            </div>
        `;
    } else if (method === 'bookmarklet') {
        inputsDiv.innerHTML = `
            <div style="background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 5px; padding: 15px; margin: 10px 0;">
                <h4 style="margin-top: 0;">How to use the Bookmarklet:</h4>
                <ol style="margin-bottom: 0;">
                    <li>Copy the bookmarklet code below</li>
                    <li>Create a new bookmark in your browser</li>
                    <li>Paste the code as the URL</li>
                    <li>Go to your YouTube playlist page</li>
                    <li>Click the bookmark to extract video data</li>
                </ol>
            </div>
            <div class="form-group">
                <label>Bookmarklet Code:</label>
                <textarea id="bookmarkletCode" readonly style="height: 100px; font-family: monospace; font-size: 12px;">javascript:(function(){const videos=[];document.querySelectorAll('#content a[href*="/watch?v="]').forEach((a,i)=>{const title=a.querySelector('#video-title')?.textContent?.trim();const url=a.href;if(title&&url){videos.push({title,url,index:i+1});}});const data=JSON.stringify(videos);const blob=new Blob([data],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='playlist_videos.json';a.click();URL.revokeObjectURL(url);alert('Video data exported! Import the JSON file in the tracker.');})();</textarea>
                <button type="button" class="btn btn-secondary" onclick="copyBookmarklet()" style="margin-top: 10px;">📋 Copy Code</button>
            </div>
        `;
    }
    */
}

/* Commented out bookmarklet function
function copyBookmarklet() {
    const textarea = document.getElementById('bookmarkletCode');
    textarea.select();
    document.execCommand('copy');
    alert('Bookmarklet copied to clipboard!');
}
*/

async function startFetch() {
    if (currentFetchMethod === 'api') {
        await fetchWithAPI();
    }
    /* Commented out web scraping and bookmarklet options
    else if (currentFetchMethod === 'scraper') {
        await fetchWithScraper();
    } else if (currentFetchMethod === 'bookmarklet') {
        alert('Please follow the bookmarklet instructions above to extract your playlist data.');
        return;
    }
    */
}

async function fetchWithAPI() {
    const playlistUrl = document.getElementById('playlistUrl').value;
    const apiKey = document.getElementById('apiKey').value;

    if (!playlistUrl || !apiKey) {
        alert('Please provide both playlist URL and API key');
        return;
    }

    const playlistId = extractPlaylistId(playlistUrl);
    if (!playlistId) {
        alert('Invalid playlist URL');
        return;
    }

    closeFetchModal();
    showLoadingModal('Fetching playlist data from YouTube API...');

    try {
        fetchController = new AbortController();
        const videos = await fetchPlaylistVideos(playlistId, apiKey, fetchController.signal);
        
        if (videos.length > 0) {
            videoData = [];
            document.getElementById('videoTableBody').innerHTML = '';
            
            videos.forEach((video, index) => {
                const newVideo = {
                    id: Date.now() + index,
                    title: video.title,
                    url: `https://www.youtube.com/watch?v=${video.videoId}`,
                    status: 'not-started',
                    dateStarted: '',
                    dateCompleted: '',
                    duration: video.duration || '',
                    notes: '',
                    lastModified: new Date().toISOString()
                };
                videoData.push(newVideo);
                addVideoToTable(newVideo, index + 1);
            });
            
            updateStats();
            hideLoadingModal();
            alert(`Successfully fetched ${videos.length} videos from the playlist!`);
        } else {
            hideLoadingModal();
            alert('No videos found in the playlist');
        }
    } catch (error) {
        hideLoadingModal();
        if (error.name !== 'AbortError') {
            alert('Error fetching playlist: ' + error.message);
        }
    }
}

/* Commented out web scraping function
async function fetchWithScraper() {
    const playlistUrl = document.getElementById('playlistUrl').value;
    
    if (!playlistUrl) {
        alert('Please provide a playlist URL');
        return;
    }

    closeFetchModal();
    showLoadingModal('Scraping playlist data...');

    try {
        // This would need a CORS proxy or server-side implementation
        // For now, provide instructions for manual extraction
        setTimeout(() => {
            hideLoadingModal();
            alert('Web scraping is blocked by CORS policy. Please use the API method or bookmarklet instead.');
        }, 2000);
    } catch (error) {
        hideLoadingModal();
        alert('Error scraping playlist: ' + error.message);
    }
}
*/

function extractPlaylistId(url) {
    const match = url.match(/[?&]list=([^&]+)/);
    return match ? match[1] : null;
}

async function fetchPlaylistVideos(playlistId, apiKey, signal) {
    const videos = [];
    let nextPageToken = '';
    
    do {
        const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${apiKey}${nextPageToken ? '&pageToken=' + nextPageToken : ''}`;
        
        const response = await fetch(url, { signal });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        for (const item of data.items) {
            videos.push({
                title: item.snippet.title,
                videoId: item.snippet.resourceId.videoId,
                description: item.snippet.description,
                publishedAt: item.snippet.publishedAt
            });
        }
        
        nextPageToken = data.nextPageToken || '';
        
        // Update loading status
        document.getElementById('loadingStatus').textContent = 
            `Fetched ${videos.length} videos...`;
        
    } while (nextPageToken);
    
    return videos;
}

function showLoadingModal(message) {
    document.getElementById('loadingStatus').textContent = message;
    document.getElementById('loadingModal').style.display = 'block';
}

function hideLoadingModal() {
    document.getElementById('loadingModal').style.display = 'none';
}

function cancelFetch() {
    if (fetchController) {
        fetchController.abort();
    }
    hideLoadingModal();
}

function addVideoToTable(video, index) {
    const tbody = document.getElementById('videoTableBody');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${index}</td>
        <td>${video.title}</td>
        <td><a href="${video.url}" class="video-link" target="_blank">Watch Video</a></td>
        <td>
            <select class="status-select status-${video.status}" onchange="updateStatus(this)" data-id="${video.id}">
                <option value="not-started" ${video.status === 'not-started' ? 'selected' : ''}>Not Started</option>
                <option value="in-progress" ${video.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                <option value="completed" ${video.status === 'completed' ? 'selected' : ''}>Completed</option>
                <option value="skipped" ${video.status === 'skipped' ? 'selected' : ''}>Skipped</option>
            </select>
        </td>
        <td><input type="date" class="form-control" value="${video.dateStarted}" onchange="updateVideoData(${video.id}, 'dateStarted', this.value)"></td>
        <td><input type="date" class="form-control" value="${video.dateCompleted}" onchange="updateVideoData(${video.id}, 'dateCompleted', this.value)"></td>
        <td><input type="text" placeholder="e.g., 15:30" style="width: 80px;" value="${video.duration}" onchange="updateVideoData(${video.id}, 'duration', this.value)"></td>
        <td><textarea class="notes-input" placeholder="Add notes..." onchange="updateVideoData(${video.id}, 'notes', this.value)">${video.notes}</textarea></td>
        <td><button class="btn btn-secondary" onclick="deleteRow(this)" style="padding: 5px 10px; font-size: 12px;" data-id="${video.id}">🗑️</button></td>
    `;
    tbody.appendChild(row);
}

function updateStatus(select) {
    const id = parseInt(select.getAttribute('data-id'));
    const status = select.value;
    const video = videoData.find(v => v.id === id);
    if (video) {
        video.status = status;
        video.lastModified = new Date().toISOString();
        select.className = `status-select status-${status}`;
        
        // Auto-update dates
        const now = new Date().toISOString().split('T')[0];
        if (status === 'in-progress' && !video.dateStarted) {
            video.dateStarted = now;
            select.closest('tr').querySelector('input[type="date"]').value = now;
        }
        if (status === 'completed' && !video.dateCompleted) {
            video.dateCompleted = now;
            select.closest('tr').querySelectorAll('input[type="date"]')[1].value = now;
        }
        
        updateStats();
        saveToLocalStorage(); // Save after status update
    }
}

function updateVideoData(id, field, value) {
    const video = videoData.find(v => v.id === id);
    if (video) {
        video[field] = value;
        video.lastModified = new Date().toISOString();
        saveToLocalStorage(); // Save after data update
    }
}

function deleteRow(button) {
    const id = parseInt(button.getAttribute('data-id'));
    videoData = videoData.filter(v => v.id !== id);
    button.closest('tr').remove();
    updateStats();
    reindexTable();
    saveToLocalStorage(); // Save after deletion
}

function reindexTable() {
    const rows = document.querySelectorAll('#videoTableBody tr');
    rows.forEach((row, index) => {
        row.cells[0].textContent = index + 1;
    });
}

function filterVideos() {
    const searchTerm = document.getElementById('searchBox').value.toLowerCase();
    const rows = document.querySelectorAll('#videoTableBody tr');
    
    rows.forEach(row => {
        const title = row.cells[1].textContent.toLowerCase();
        const status = row.cells[3].textContent.toLowerCase();
        const notes = row.cells[7].textContent.toLowerCase();
        
        if (title.includes(searchTerm) || status.includes(searchTerm) || notes.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function exportToCSV() {
    const headers = ['#', 'Video Title', 'Video Link', 'Status', 'Date Started', 'Date Completed', 'Duration', 'Notes'];
    const csvContent = [
        headers.join(','),
        ...videoData.map((video, index) => [
            index + 1,
            `"${video.title}"`,
            `"${video.url}"`,
            video.status,
            video.dateStarted,
            video.dateCompleted,
            `"${video.duration}"`,
            `"${video.notes.replace(/"/g, '""')}"`
        ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'video_progress_tracker.csv';
    a.click();
    URL.revokeObjectURL(url);
}

function importFromCSV() {
    document.getElementById('csvFile').click();
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const csv = e.target.result;
            const lines = csv.split('\n').slice(1); // Skip header
            
            videoData = [];
            document.getElementById('videoTableBody').innerHTML = '';
            
            lines.forEach((line, index) => {
                if (line.trim()) {
                    const cols = line.split(',');
                    const video = {
                        id: Date.now() + index,
                        title: cols[1]?.replace(/"/g, '') || '',
                        url: cols[2]?.replace(/"/g, '') || '#',
                        status: cols[3] || 'not-started',
                        dateStarted: cols[4] || '',
                        dateCompleted: cols[5] || '',
                        duration: cols[6]?.replace(/"/g, '') || '',
                        notes: cols[7]?.replace(/"/g, '').replace(/""/g, '"') || '',
                        lastModified: new Date().toISOString()
                    };
                    videoData.push(video);
                    addVideoToTable(video, index + 1);
                }
            });
            
            updateStats();
        };
        reader.readAsText(file);
    }
}

// Initialize
window.onclick = function(event) {
    if (event.target === document.getElementById('addVideoModal')) {
        closeModal();
    }
    if (event.target === document.getElementById('fetchModal')) {
        closeFetchModal();
    }
}

// Modified initialization to load saved data
document.addEventListener('DOMContentLoaded', function() {
    loadFromLocalStorage();
    updateStats();
    
    // Optional: Set up periodic sync with database
    setInterval(() => {
        syncWithDatabase();
    }, 5 * 60 * 1000); // Sync every 5 minutes
}); 