/* ============================================================
   ILovePlaylist — Script
   Hardcoded playlist — auto-fetches on first visit,
   then works from localStorage on every subsequent visit.
   ============================================================ */

// ─── Hardcoded Config ────────────────────────────────────────
const PLAYLIST_ID     = 'PLxbwE86jKRgMpuZuLBivzlM8s2Dk5lXBQ';

// ─── State ───────────────────────────────────────────────────
let videoData       = [];
let currentFilter   = 'all';
let fetchController = null;

// ─── LocalStorage ────────────────────────────────────────────
function saveToLocalStorage() {
    localStorage.setItem('ilpData',    JSON.stringify(videoData));
    localStorage.setItem('ilpDark',    document.documentElement.getAttribute('data-theme') || 'light');
    localStorage.setItem('ilpUpdated', new Date().toISOString());
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('ilpData');
    const theme = localStorage.getItem('ilpDark');
    if (theme === 'dark') applyDarkMode(true);

    if (saved) {
        videoData = JSON.parse(saved);
        document.getElementById('videoTableBody').innerHTML = '';
        videoData.forEach((v, i) => addVideoToTable(v, i + 1));
        updateStats();
        toggleEmptyState();
    } else {
        // First visit — auto-fetch the hardcoded playlist
        toggleEmptyState();
        autoFetchPlaylist();
    }
}

// ─── Auto-Fetch on First Load ────────────────────────────────
async function autoFetchPlaylist() {
    showLoadingModal('Loading your CCNA playlist…');
    try {
        fetchController = new AbortController();

        const resp = await fetch('/api/playlist', { signal: fetchController.signal });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || `Server error ${resp.status}`);
        }

        const data    = await resp.json();          // { items: [...], title }
        const videos  = data.items || [];

        if (videos.length === 0) {
            hideLoadingModal();
            showToast('No videos found in the playlist.', 'error');
            return;
        }

        videoData = [];
        document.getElementById('videoTableBody').innerHTML = '';

        videos.forEach((video, index) => {
            const v = {
                id:            Date.now() + index,
                title:         video.title,
                url:           `https://www.youtube.com/watch?v=${video.videoId}`,
                status:        'not-started',
                dateStarted:   '',
                dateCompleted: '',
                duration:      video.duration || '',
                notes:         '',
                lastModified:  new Date().toISOString()
            };
            videoData.push(v);
            addVideoToTable(v, index + 1);
        });

        updateStats();
        saveToLocalStorage();
        hideLoadingModal();
        showToast(`🎉 Loaded ${videos.length} videos!`, 'success');

    } catch (err) {
        hideLoadingModal();
        if (err.name !== 'AbortError') {
            showToast('Could not load playlist: ' + err.message, 'error');
        }
    }
}

// Manual refresh — clears saved data and re-fetches live
async function refreshPlaylist() {
    if (!confirm('This will re-fetch the playlist and reset all your progress. Continue?')) return;
    localStorage.removeItem('ilpData');
    videoData = [];
    document.getElementById('videoTableBody').innerHTML = '';
    updateStats();
    await autoFetchPlaylist();
}

// ─── API Fetch (unused — proxy handles everything) ────────────
async function fetchPlaylistVideos() { /* handled by /api/playlist */ }

// ─── Toast Notifications ─────────────────────────────────────
function showToast(message, type = 'info') {
    const icons     = { success: '✅', error: '❌', info: 'ℹ️' };
    const container = document.getElementById('toastContainer');
    const toast     = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span class="toast-msg">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, 3500);
}

// ─── Dark Mode ───────────────────────────────────────────────
function applyDarkMode(isDark) {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.getElementById('darkModeIcon').textContent = isDark ? '☀️' : '🌙';
}

function toggleDarkMode() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    applyDarkMode(!isDark);
    saveToLocalStorage();
}

// ─── Stats ───────────────────────────────────────────────────
function updateStats() {
    const total      = videoData.length;
    const completed  = videoData.filter(v => v.status === 'completed').length;
    const inProgress = videoData.filter(v => v.status === 'in-progress').length;
    const pct        = total > 0 ? Math.round((completed / total) * 100) : 0;

    document.getElementById('totalVideos').textContent       = total;
    document.getElementById('completedVideos').textContent   = completed;
    document.getElementById('inProgressVideos').textContent  = inProgress;
    document.getElementById('progressPercentage').textContent = pct + '%';
    document.getElementById('progressFill').style.width      = pct + '%';
    document.getElementById('progressLabel').textContent     = `${completed} / ${total} videos`;

    const bar = document.getElementById('progressBarWrapper');
    if (bar) bar.setAttribute('aria-valuenow', pct);

    toggleEmptyState();
}

// ─── Empty State ─────────────────────────────────────────────
function toggleEmptyState() {
    const state = document.getElementById('emptyState');
    if (!state) return;
    state.classList.toggle('visible', videoData.length === 0);
}

// ─── Add Video Modal (manual entry still available) ──────────
function addVideo() {
    openModal('addVideoModal');
}

function closeModal() {
    closeModalById('addVideoModal');
    document.getElementById('videoTitle').value    = '';
    document.getElementById('videoUrl').value      = '';
    document.getElementById('videoDuration').value = '';
}

function saveVideo() {
    const title    = document.getElementById('videoTitle').value.trim();
    const url      = document.getElementById('videoUrl').value.trim();
    const duration = document.getElementById('videoDuration').value.trim();

    if (!title) {
        showToast('Please enter a video title.', 'error');
        document.getElementById('videoTitle').focus();
        return;
    }

    const newVideo = {
        id:            Date.now(),
        title,
        url:           url || '#',
        status:        'not-started',
        dateStarted:   '',
        dateCompleted: '',
        duration,
        notes:         '',
        lastModified:  new Date().toISOString()
    };

    videoData.push(newVideo);
    addVideoToTable(newVideo, videoData.length);
    applyCurrentFilter();
    updateStats();
    saveToLocalStorage();
    closeModal();
    showToast(`"${title}" added!`, 'success');
}

// ─── Loading Modal ───────────────────────────────────────────
function showLoadingModal(msg) {
    const el = document.getElementById('loadingStatus');
    if (el) el.textContent = msg;
    openModal('loadingModal');
}

function hideLoadingModal() {
    closeModalById('loadingModal');
}

function cancelFetch() {
    if (fetchController) fetchController.abort();
    hideLoadingModal();
}

// ─── Modal Helpers ───────────────────────────────────────────
function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('open');
}

function closeModalById(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('open');
}

// ─── Add Row to Table ────────────────────────────────────────
function addVideoToTable(video, index) {
    const tbody = document.getElementById('videoTableBody');
    const row   = document.createElement('tr');
    row.setAttribute('data-id',     video.id);
    row.setAttribute('data-status', video.status);

    row.innerHTML = `
        <td>${index}</td>
        <td style="font-weight:600;color:var(--text);max-width:320px;word-break:break-word;">${escapeHtml(video.title)}</td>
        <td>
            <a href="${escapeHtml(video.url)}" class="video-link" target="_blank" rel="noopener" aria-label="Watch ${escapeHtml(video.title)}">
                ▶ Watch
            </a>
        </td>
        <td>
            <select class="status-select status-${video.status}"
                    onchange="updateStatus(this)"
                    data-id="${video.id}"
                    aria-label="Status">
                <option value="not-started" ${video.status === 'not-started' ? 'selected' : ''}>Not Started</option>
                <option value="in-progress" ${video.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                <option value="completed"   ${video.status === 'completed'   ? 'selected' : ''}>Completed</option>
                <option value="skipped"     ${video.status === 'skipped'     ? 'selected' : ''}>Skipped</option>
            </select>
        </td>
        <td><input type="date" class="form-control" value="${video.dateStarted}"
                   onchange="updateVideoData(${video.id}, 'dateStarted', this.value)"
                   aria-label="Date started"></td>
        <td><input type="date" class="form-control" value="${video.dateCompleted}"
                   onchange="updateVideoData(${video.id}, 'dateCompleted', this.value)"
                   aria-label="Date completed"></td>
        <td><input type="text" class="duration-input" placeholder="15:30"
                   value="${escapeHtml(video.duration)}"
                   onchange="updateVideoData(${video.id}, 'duration', this.value)"
                   aria-label="Duration"></td>
        <td><textarea class="notes-input" placeholder="Add notes…"
                      onchange="updateVideoData(${video.id}, 'notes', this.value)"
                      aria-label="Notes">${escapeHtml(video.notes)}</textarea></td>
        <td>
            <button class="delete-btn" onclick="deleteRow(this)" data-id="${video.id}" title="Remove" aria-label="Remove">🗑</button>
        </td>
    `;
    tbody.appendChild(row);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ─── Status Update ───────────────────────────────────────────
function updateStatus(select) {
    const id     = parseInt(select.getAttribute('data-id'));
    const status = select.value;
    const video  = videoData.find(v => v.id === id);
    if (!video) return;

    video.status       = status;
    video.lastModified = new Date().toISOString();
    select.className   = `status-select status-${status}`;

    const row = select.closest('tr');
    if (row) row.setAttribute('data-status', status);

    const now = new Date().toISOString().split('T')[0];
    if (status === 'in-progress' && !video.dateStarted) {
        video.dateStarted = now;
        const dates = row.querySelectorAll('input[type="date"]');
        if (dates[0]) dates[0].value = now;
    }
    if (status === 'completed' && !video.dateCompleted) {
        video.dateCompleted = now;
        const dates = row.querySelectorAll('input[type="date"]');
        if (dates[1]) dates[1].value = now;
    }

    applyCurrentFilter();
    updateStats();
    saveToLocalStorage();
}

function updateVideoData(id, field, value) {
    const video = videoData.find(v => v.id === id);
    if (video) {
        video[field]       = value;
        video.lastModified = new Date().toISOString();
        saveToLocalStorage();
    }
}

// ─── Delete ──────────────────────────────────────────────────
function deleteRow(button) {
    const id  = parseInt(button.getAttribute('data-id'));
    const row = button.closest('tr');
    if (!row) return;

    row.style.transition = 'opacity .2s, transform .2s';
    row.style.opacity    = '0';
    row.style.transform  = 'scale(.97)';

    setTimeout(() => {
        videoData = videoData.filter(v => v.id !== id);
        row.remove();
        reindexTable();
        updateStats();
        saveToLocalStorage();
    }, 200);
}

function reindexTable() {
    document.querySelectorAll('#videoTableBody tr').forEach((row, i) => {
        row.cells[0].textContent = i + 1;
    });
}

// ─── Search / Filter ─────────────────────────────────────────
function filterVideos() {
    applyCurrentFilter();
}

function setFilter(btn, filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    applyCurrentFilter();
}

function applyCurrentFilter() {
    const searchTerm = (document.getElementById('searchBox')?.value || '').toLowerCase();
    document.querySelectorAll('#videoTableBody tr').forEach(row => {
        const status      = row.getAttribute('data-status') || '';
        const title       = (row.cells[1]?.textContent || '').toLowerCase();
        const notes       = (row.cells[7]?.textContent || '').toLowerCase();
        const matchFilter = currentFilter === 'all' || status === currentFilter;
        const matchSearch = !searchTerm || title.includes(searchTerm) || notes.includes(searchTerm);
        row.style.display = (matchFilter && matchSearch) ? '' : 'none';
    });
}

// ─── Export CSV ──────────────────────────────────────────────
function exportToCSV() {
    if (videoData.length === 0) {
        showToast('Nothing to export yet!', 'info');
        return;
    }
    const headers = ['#', 'Title', 'URL', 'Status', 'Date Started', 'Date Completed', 'Duration', 'Notes'];
    const rows    = videoData.map((v, i) => [
        i + 1,
        `"${v.title.replace(/"/g, '""')}"`,
        `"${v.url}"`,
        v.status,
        v.dateStarted,
        v.dateCompleted,
        `"${v.duration}"`,
        `"${v.notes.replace(/"/g, '""')}"`
    ].join(','));

    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const a    = Object.assign(document.createElement('a'), {
        href:     URL.createObjectURL(blob),
        download: 'iLovePlaylist_progress.csv'
    });
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Progress exported as CSV!', 'success');
}

function importFromCSV() {
    document.getElementById('csvFile').click();
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader    = new FileReader();
    reader.onload   = function(e) {
        const lines = e.target.result.split('\n').slice(1);
        videoData   = [];
        document.getElementById('videoTableBody').innerHTML = '';

        lines.forEach((line, i) => {
            if (!line.trim()) return;
            const cols = parseCSVLine(line);
            const v    = {
                id:            Date.now() + i,
                title:         cols[1] || '',
                url:           cols[2] || '#',
                status:        cols[3] || 'not-started',
                dateStarted:   cols[4] || '',
                dateCompleted: cols[5] || '',
                duration:      cols[6] || '',
                notes:         cols[7] || '',
                lastModified:  new Date().toISOString()
            };
            videoData.push(v);
            addVideoToTable(v, i + 1);
        });

        updateStats();
        saveToLocalStorage();
        showToast(`Imported ${videoData.length} videos.`, 'success');
    };
    reader.readAsText(file);
    event.target.value = '';
}

function parseCSVLine(line) {
    const result = [];
    let current  = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            result.push(current.trim()); current = '';
        } else {
            current += ch;
        }
    }
    result.push(current.trim());
    return result;
}

// ─── Keyboard Shortcuts ──────────────────────────────────────
document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        addVideo();
    }
    if (e.key === 'Escape') {
        closeModal();
        hideLoadingModal();
    }
});

// ─── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
});