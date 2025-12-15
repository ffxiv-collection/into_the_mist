import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase;

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            console.error('Supabase vars missing');
            return;
        }
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase initialized');

        // Check Session
        const { data: { session } } = await supabase.auth.getSession();
        updateUI(session);

        // Listen for auth changes
        supabase.auth.onAuthStateChange((_event, session) => {
            updateUI(session);
        });

        // Setup Event Listeners
        setupEventListeners();

        // Init Audio
        initAudio();

        // Load Sprites (Only needed if NOT logged in, but benign to load anyway)
        // If session exists, we don't strictly need them, but logic handles view switching.
        if (!session) fetchSprites();

    } catch (e) {
        console.error('Init error', e);
    }
});

// --- UI UPDATES ---
function updateUI(session) {
    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    const audioBtn = document.getElementById('audio-toggle');

    if (session) {
        // Logged In
        loginView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        if (audioBtn) audioBtn.style.display = 'none'; // Hide music toggle on dashboard
    } else {
        // Logged Out
        loginView.classList.remove('hidden');
        dashboardView.classList.add('hidden');
        if (audioBtn) audioBtn.style.display = 'flex';
        fetchSprites();
    }
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const errorMsg = document.getElementById('error-msg');
            const submitBtn = document.getElementById('login-btn');

            errorMsg.style.display = 'none';
            submitBtn.disabled = true;
            submitBtn.textContent = 'Connexion...';

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            submitBtn.disabled = false;
            submitBtn.textContent = 'Se connecter';

            if (error) {
                errorMsg.textContent = "Erreur : " + error.message;
                errorMsg.style.display = 'block';
            } else {
                console.log('Login success', data);
                // Trigger Sound Effect specifically here on explicit login action
                handleLoginSound();
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
        });
    }
}

// --- SPRITES LOGIC (Decoration) ---
async function fetchSprites() {
    const container = document.getElementById('supabase-data');
    if (!container) return;

    if (container.children.length > 0) return;

    const { data, error } = await supabase.from('sprites').select('*');
    if (error || !data) return;

    const placedPositions = [];
    container.innerHTML = '';

    data.forEach((spriteData, index) => {
        const sprite = document.createElement('div');
        sprite.className = 'floating-sprite';
        const url = spriteData.icon_sprite_url;
        if (!url) return;

        sprite.style.backgroundImage = `url('${url}')`;

        // Rejection Sampling
        let validX = 0, validY = 0;
        let found = false;

        for (let attempt = 0; attempt < 50; attempt++) {
            const cx = Math.random() * 90 + 2;
            const cy = Math.random() * 55 + 35; // Below banner

            // Avoid Center Box (Login form approx position)
            // Left boundary: 30%, Right boundary: 70%
            const inCenterZone = (cx > 28 && cx < 72);
            if (inCenterZone) continue;

            if (isTooClose(cx, cy, placedPositions)) continue;

            validX = cx;
            validY = cy;
            found = true;
            break;
        }

        if (found) {
            sprite.style.left = `${validX}%`;
            sprite.style.top = `${validY}%`;
            sprite.style.animationDelay = `-${Math.random() * 5}s`;
            container.appendChild(sprite);
            placedPositions.push({ x: validX, y: validY });
        }
    });
}

function isTooClose(x, y, existingPositions, minDistance = 8) {
    for (const pos of existingPositions) {
        const dx = x - pos.x;
        const dy = (y - pos.y) * 0.56;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDistance) return true;
    }
    return false;
}

// --- AUDIO MANAGER ---
const audioState = {
    bgMusic: new Audio('https://res.cloudinary.com/dd4rdtrig/video/upload/v1765756518/003_Prelude_Discoveries_ofr2of.mp3'),
    loginSound: new Audio('https://res.cloudinary.com/dd4rdtrig/video/upload/v1765756726/FFXIV_Start_Game_hclxwe.mp3'),
    isPlaying: false,
    userInteracted: false
};

// Config
audioState.bgMusic.loop = true;
audioState.bgMusic.volume = 0.5;
audioState.loginSound.volume = 0.6;

function initAudio() {
    const btn = document.getElementById('audio-toggle');
    const icon = document.getElementById('audio-icon');

    // Attempt Autoplay
    // Note: Most browsers block this until interaction
    const playPromise = audioState.bgMusic.play();

    if (playPromise !== undefined) {
        playPromise.then(() => {
            audioState.isPlaying = true;
            updateAudioIcon(true);
        }).catch(error => {
            console.log("Autoplay blocked. Waiting for interaction.");
            audioState.isPlaying = false;
            updateAudioIcon(false);
        });
    }

    // Toggle Button
    if (btn) {
        btn.addEventListener('click', () => {
            if (audioState.isPlaying) {
                audioState.bgMusic.pause();
                audioState.isPlaying = false;
            } else {
                audioState.bgMusic.play();
                audioState.isPlaying = true;
                audioState.userInteracted = true;
            }
            updateAudioIcon(audioState.isPlaying);
        });
    }

    // Capture first interaction to unlock AudioContext if needed
    document.addEventListener('click', () => {
        if (!audioState.userInteracted && !audioState.isPlaying) {
            // Optional logic: Auto-play on first click if it was blocked?
            // For now, let user control via button to avoid annoyance
        }
        audioState.userInteracted = true;
    }, { once: true });
}

function updateAudioIcon(isPlaying) {
    const icon = document.getElementById('audio-icon');
    if (icon) icon.textContent = isPlaying ? '🔊' : '🔇';
}

function handleLoginSound() {
    // Stop BG Music
    audioState.bgMusic.pause();
    audioState.bgMusic.currentTime = 0;

    // Play Success Sound
    audioState.loginSound.play().catch(e => console.log("Login sound blocked", e));
}
