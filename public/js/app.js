// Global variables
let currentUser = null;
let authToken = null;
let meditations = [];
let currentMeditation = null;
let audioPlayer = null;
let isPlaying = false;
let currentTime = 0;
let duration = 0;
let timerInterval = null;
let meditationTimer = null;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    // Check if user is authenticated
    authToken = localStorage.getItem('authToken');
    
    if (authToken) {
        // Verify token with server
        await verifyAuth();
    } else {
        showAuthModal();
    }
    
    // Load meditations
    await loadMeditations();
    
    // Setup event listeners
    setupEventListeners();
}

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const section = e.target.dataset.section;
            showSection(section);
        });
    });
    
    // Category cards
    document.querySelectorAll('.category-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const category = e.currentTarget.dataset.category;
            showMeditationsByCategory(category);
        });
    });
    
    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const category = e.target.dataset.category;
            filterMeditations(category);
        });
    });
    
    // Auth tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            switchAuthTab(e.target.dataset.tab);
        });
    });
    
    // Auth forms
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Preferences form
    document.getElementById('preferencesForm').addEventListener('submit', handlePreferencesUpdate);
    
    // Timer buttons
    document.querySelectorAll('.timer-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const minutes = parseInt(e.target.dataset.minutes);
            setMeditationTimer(minutes);
        });
    });
    
    // Custom timer
    document.getElementById('setCustomTimer').addEventListener('click', () => {
        const minutes = parseInt(document.getElementById('customMinutes').value);
        if (minutes > 0 && minutes <= 60) {
            setMeditationTimer(minutes);
            // Clear the custom input
            document.getElementById('customMinutes').value = '';
        } else {
            showNotification('Please enter a valid duration between 1 and 60 minutes');
        }
    });
    
    // Custom timer input - Enter key support
    document.getElementById('customMinutes').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const minutes = parseInt(document.getElementById('customMinutes').value);
            if (minutes > 0 && minutes <= 60) {
                setMeditationTimer(minutes);
                // Clear the custom input
                document.getElementById('customMinutes').value = '';
            } else {
                showNotification('Please enter a valid duration between 1 and 60 minutes');
            }
        }
    });
    
    // Cancel timer button
    document.getElementById('cancelTimer').addEventListener('click', cancelMeditationTimer);
    
    // Volume controls
    document.getElementById('volume').addEventListener('input', updateVolume);
    document.getElementById('playerVolume').addEventListener('input', updatePlayerVolume);
    
    // Play/Pause button
    document.getElementById('playPauseBtn').addEventListener('click', togglePlayPause);
    
    // Progress bar click
    document.querySelector('.progress-bar').addEventListener('click', (e) => {
        if (!audioPlayer) return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;
        const clickPercent = clickX / width;
        
        audioPlayer.currentTime = clickPercent * duration;
    });
}

// ===== Authentication Functions =====

function showAuthModal() {
    document.getElementById('authModal').classList.add('active');
}

function closeAuthModal() {
    document.getElementById('authModal').classList.remove('active');
}

function switchAuthTab(tab) {
    // Update tabs
    document.querySelectorAll('.auth-tab').forEach(t => {
        t.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    
    // Update forms
    document.querySelectorAll('.auth-form').forEach(f => {
        f.classList.remove('active');
    });
    document.getElementById(`${tab}Form`).classList.add('active');
    
    // Clear error messages
    document.getElementById('loginError').style.display = 'none';
    document.getElementById('registerError').style.display = 'none';
}

async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const errorElement = document.getElementById('loginError');
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            updateUserInterface();
            closeAuthModal();
            showNotification('Login successful! Welcome back.');
        } else {
            errorElement.textContent = data.error;
            errorElement.style.display = 'block';
        }
    } catch (error) {
        console.error('Login error:', error);
        errorElement.textContent = 'Login failed. Please try again.';
        errorElement.style.display = 'block';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
    const errorElement = document.getElementById('registerError');
    
    // Validate passwords match
    if (password !== passwordConfirm) {
        errorElement.textContent = 'Passwords do not match';
        errorElement.style.display = 'block';
        return;
    }
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            updateUserInterface();
            closeAuthModal();
            showNotification('Registration successful! Welcome to Serinity.');
        } else {
            errorElement.textContent = data.error;
            errorElement.style.display = 'block';
        }
    } catch (error) {
        console.error('Registration error:', error);
        errorElement.textContent = 'Registration failed. Please try again.';
        errorElement.style.display = 'block';
    }
}

async function handleLogout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        
        // Clear local data
        authToken = null;
        currentUser = null;
        localStorage.removeItem('authToken');
        
        // Hide logout button
        document.getElementById('logoutBtn').style.display = 'none';
        
        // Show auth modal
        showAuthModal();
        showNotification('Logged out successfully.');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

async function verifyAuth() {
    try {
        const response = await fetch('/api/auth/verify', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            updateUserInterface();
        } else {
            // Token is invalid
            localStorage.removeItem('authToken');
            authToken = null;
            showAuthModal();
        }
    } catch (error) {
        console.error('Auth verification error:', error);
        localStorage.removeItem('authToken');
        authToken = null;
        showAuthModal();
    }
}

function updateUserInterface() {
    if (currentUser) {
        // Show logout button
        document.getElementById('logoutBtn').style.display = 'flex';
        
        // Update profile
        document.getElementById('userName').textContent = currentUser.username;
        document.getElementById('userEmail').textContent = currentUser.email;
        
        // Update preferences form
        document.getElementById('defaultDuration').value = currentUser.preferences.defaultDuration;
        document.getElementById('favoriteCategory').value = currentUser.preferences.favoriteCategory;
        document.getElementById('volume').value = currentUser.preferences.volume;
        document.getElementById('notifications').checked = currentUser.preferences.notifications;
        document.getElementById('volumeValue').textContent = Math.round(currentUser.preferences.volume * 100) + '%';
        
        // Load user history
        loadUserHistory();
    }
}

// ===== Navigation =====

function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionName).classList.add('active');
    
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
    
    // Load section-specific content
    if (sectionName === 'meditations') {
        loadMeditations();
    }
}

// ===== Meditation Management =====

async function loadMeditations() {
    try {
        const response = await fetch('/api/meditations');
        meditations = await response.json();
        displayMeditations(meditations);
    } catch (error) {
        console.error('Error loading meditations:', error);
    }
}

function displayMeditations(meditationsToShow) {
    const grid = document.getElementById('meditationsGrid');
    grid.innerHTML = '';
    
    meditationsToShow.forEach(meditation => {
        const card = createMeditationCard(meditation);
        grid.appendChild(card);
    });
}

function createMeditationCard(meditation) {
    const card = document.createElement('div');
    card.className = 'meditation-card';
    card.innerHTML = `
        <div class="meditation-header">
            <div>
                <h3 class="meditation-title">${meditation.title}</h3>
                <span class="meditation-category">${formatCategory(meditation.category)}</span>
            </div>
            <div class="meditation-duration">${meditation.duration} min</div>
        </div>
        <p class="meditation-description">${meditation.description}</p>
    `;
    
    card.addEventListener('click', () => openMeditationModal(meditation));
    return card;
}

function formatCategory(category) {
    const categoryMap = {
        'morning-calm': 'Morning Calm',
        'stress-relief': 'Stress Relief',
        'sleep-journey': 'Sleep Journey',
        'mindful-practice': 'Mindful Practice',
        'gratitude': 'Gratitude',
        'focus-clarity': 'Focus & Clarity'
    };
    return categoryMap[category] || category;
}

function filterMeditations(category) {
    // Update filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-category="${category}"]`).classList.add('active');
    
    // Filter meditations
    let filteredMeditations = meditations;
    if (category !== 'all') {
        filteredMeditations = meditations.filter(m => m.category === category);
    }
    
    displayMeditations(filteredMeditations);
}

function showMeditationsByCategory(category) {
    showSection('meditations');
    setTimeout(() => filterMeditations(category), 100);
}

// ===== Modal Management =====

function openMeditationModal(meditation) {
    currentMeditation = meditation;
    
    // Update modal content
    document.getElementById('modalTitle').textContent = meditation.title;
    document.getElementById('modalDescription').textContent = meditation.description;
    document.getElementById('modalDuration').textContent = meditation.duration + ' minutes';
    
    // Show modal
    document.getElementById('meditationModal').classList.add('active');
    
    // Initialize audio player
    initializeAudioPlayer();
}

function closeModal() {
    document.getElementById('meditationModal').classList.remove('active');
    
    // Stop audio
    if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
    }
    
    // Clear timer
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    if (meditationTimer) {
        clearTimeout(meditationTimer);
        meditationTimer = null;
    }
    
    // Hide countdown display
    document.getElementById('timerCountdown').style.display = 'none';
    
    // Remove active state from timer buttons
    document.querySelectorAll('.timer-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Reset player
    isPlaying = false;
    updatePlayButton();
    updateProgress(0);
}

function initializeAudioPlayer() {
    // Create audio element if it doesn't exist
    if (!audioPlayer) {
        audioPlayer = new Audio();
        audioPlayer.addEventListener('loadedmetadata', () => {
            duration = audioPlayer.duration;
            updateTimeDisplay(0, duration);
        });
        
        audioPlayer.addEventListener('timeupdate', () => {
            currentTime = audioPlayer.currentTime;
            updateProgress(currentTime / duration * 100);
            updateTimeDisplay(currentTime, duration);
        });
        
        audioPlayer.addEventListener('ended', () => {
            isPlaying = false;
            updatePlayButton();
            updateProgress(0);
            currentTime = 0;
        });
    }
    
    // ✅ Validate audio source before setting it
    if (!currentMeditation || !currentMeditation.audioUrl) {
        console.error('No valid audio URL for meditation:', currentMeditation);
        showNotification('Audio file not available for this meditation.');
        return;
    }
    
    // Set audio source
    audioPlayer.src = currentMeditation.audioUrl;
    audioPlayer.volume = currentUser ? currentUser.preferences.volume : 0.7;
    
    // Update player volume control
    document.getElementById('playerVolume').value = audioPlayer.volume;
}

// ===== Audio Controls =====

function togglePlayPause() {
    if (!audioPlayer) return;
    
    // ✅ Ensure a source is set before playing
    if (!audioPlayer.src || audioPlayer.src === '') {
        console.error('No audio source set. Cannot play.');
        showNotification('No audio file available for this meditation.');
        return;
    }

    if (isPlaying) {
        audioPlayer.pause();
        isPlaying = false;
    } else {
        audioPlayer.play().catch(error => {
            console.error('Error playing audio:', error);
            showNotification('Error playing audio. Please try again.');
            isPlaying = false;
            updatePlayButton();
        });
        isPlaying = true;
    }
    
    updatePlayButton();
}

function updatePlayButton() {
    const btn = document.getElementById('playPauseBtn');
    const icon = btn.querySelector('i');
    
    if (isPlaying) {
        icon.className = 'fas fa-pause';
    } else {
        icon.className = 'fas fa-play';
    }
}

function updateProgress(percent) {
    document.getElementById('progress').style.width = percent + '%';
}

function updateTimeDisplay(current, total) {
    document.getElementById('currentTime').textContent = formatTime(current);
    document.getElementById('totalTime').textContent = formatTime(total);
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateVolume() {
    const volume = parseFloat(document.getElementById('volume').value);
    document.getElementById('volumeValue').textContent = Math.round(volume * 100) + '%';
    
    if (currentUser) {
        currentUser.preferences.volume = volume;
        updateUserPreferences();
    }
}

function updatePlayerVolume() {
    const volume = parseFloat(document.getElementById('playerVolume').value);
    if (audioPlayer) {
        audioPlayer.volume = volume;
    }
}

// ===== Timer Functions =====

function setMeditationTimer(minutes) {
    // Clear existing timer
    if (meditationTimer) {
        clearTimeout(meditationTimer);
    }
    
    // Clear existing countdown interval
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    // Update timer buttons
    document.querySelectorAll('.timer-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`[data-minutes="${minutes}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    // Set timer
    meditationTimer = setTimeout(() => {
        if (audioPlayer && isPlaying) {
            audioPlayer.pause();
            isPlaying = false;
            updatePlayButton();
        }
        
        // Add to history
        if (currentUser && currentMeditation) {
            addToHistory(currentMeditation._id, currentMeditation.category, minutes);
        }
        
        // Clear countdown display
        document.getElementById('timerCountdown').style.display = 'none';
        
        // Remove active state from timer buttons
        document.querySelectorAll('.timer-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        alert(`Meditation timer completed! You've meditated for ${minutes} minutes.`);
    }, minutes * 60 * 1000);
    
    // Show timer countdown
    showTimerCountdown(minutes);
    
    // Show notification
    showNotification(`Timer set for ${minutes} minutes`);
}

function showTimerCountdown(minutes) {
    let remaining = minutes * 60;
    
    // Show countdown display
    const countdownElement = document.getElementById('timerCountdown');
    const countdownTimeElement = document.getElementById('countdownTime');
    countdownElement.style.display = 'block';
    
    // Clear any existing interval
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    // Update countdown immediately
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    countdownTimeElement.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    timerInterval = setInterval(() => {
        remaining--;
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        
        // Update countdown display
        countdownTimeElement.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        
        if (remaining <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            countdownElement.style.display = 'none';
        }
    }, 1000);
}

function cancelMeditationTimer() {
    // Clear timer
    if (meditationTimer) {
        clearTimeout(meditationTimer);
        meditationTimer = null;
    }
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    // Hide countdown display
    document.getElementById('timerCountdown').style.display = 'none';
    
    // Remove active state from timer buttons
    document.querySelectorAll('.timer-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    showNotification('Timer cancelled');
}

// ===== Preferences Management =====

async function handlePreferencesUpdate(e) {
    e.preventDefault();
    
    const preferences = {
        defaultDuration: parseInt(document.getElementById('defaultDuration').value),
        favoriteCategory: document.getElementById('favoriteCategory').value,
        volume: parseFloat(document.getElementById('volume').value),
        notifications: document.getElementById('notifications').checked
    };
    
    try {
        const response = await fetch('/api/user/preferences', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            credentials: 'include',
            body: JSON.stringify(preferences)
        });
        
        if (response.ok) {
            currentUser = await response.json();
            showNotification('Preferences saved successfully!');
        } else {
            alert('Error saving preferences. Please try again.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error saving preferences. Please try again.');
    }
}

async function updateUserPreferences() {
    if (!currentUser) return;
    
    try {
        const response = await fetch('/api/user/preferences', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            credentials: 'include',
            body: JSON.stringify(currentUser.preferences)
        });
        
        if (response.ok) {
            currentUser = await response.json();
        }
    } catch (error) {
        console.error('Error updating preferences:', error);
    }
}

// ===== History Management =====

async function loadUserHistory() {
    if (!currentUser) return;
    
    try {
        const response = await fetch('/api/user/profile', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            credentials: 'include'
        });
        
        const user = await response.json();
        displayHistory(user.meditationHistory);
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

function displayHistory(history) {
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '';
    
    if (history.length === 0) {
        historyList.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">No meditation history yet. Start your first meditation!</p>';
        return;
    }
    
    // Sort by most recent
    const sortedHistory = history.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
    
    sortedHistory.forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        const meditation = meditations.find(m => m._id === item.meditationId);
        const meditationTitle = meditation ? meditation.title : 'Unknown Meditation';
        
        historyItem.innerHTML = `
            <div class="history-info">
                <h4>${meditationTitle}</h4>
                <p>${formatCategory(item.category)} • ${new Date(item.completedAt).toLocaleDateString()}</p>
            </div>
            <div class="history-duration">${item.duration} min</div>
        `;
        
        historyList.appendChild(historyItem);
    });
}

async function addToHistory(meditationId, category, duration) {
    if (!currentUser) return;
    
    try {
        const response = await fetch('/api/user/history', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            credentials: 'include',
            body: JSON.stringify({
                meditationId,
                category,
                duration
            })
        });
        
        if (response.ok) {
            currentUser = await response.json();
        }
    } catch (error) {
        console.error('Error adding to history:', error);
    }
}

// ===== Utility Functions =====

function showNotification(message) {
    // Simple notification - you can enhance this
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #667eea;
        color: white;
        padding: 1rem 2rem;
        border-radius: 10px;
        z-index: 3000;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}
