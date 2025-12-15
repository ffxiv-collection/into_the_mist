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

        // Init Audio
        initAudioListeners();

        // Check Session
        const { data: { session } } = await supabase.auth.getSession();

        // Update UI determines if we play music
        updateUI(session);

        // Listen for auth changes
        supabase.auth.onAuthStateChange((_event, session) => {
            updateUI(session);
        });

        // Setup Event Listeners
        setupEventListeners();

        // Load Sprites (Only needed if NOT logged in)
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
        if (audioBtn) audioBtn.style.display = 'none';

        stopBgMusic();
    } else {
        // Logged Out
        loginView.classList.remove('hidden');
        dashboardView.classList.add('hidden');
        if (audioBtn) audioBtn.style.display = 'flex';
        fetchSprites();
        startBgMusic();
    }
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    initDashboardNav(); // Setup Menu Clicks

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

// --- DASHBOARD NAVIGATION ---
function initDashboardNav() {
    const links = document.querySelectorAll('.nav-link');
    const sections = {
        'Accueil': 'dashboard-home',
        'Mascottes': 'minions-view',
        'Montures': 'mounts-view',
        'Bardes': 'barding-view',
        'Orchestion': 'orchestrion-view'
    };

    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            // Filter out if it's external or special but here we assume all .nav-link are views
            const text = link.textContent.trim();
            const targetId = sections[text];
            if (!targetId) return;

            // Active State
            links.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Hide all
            document.querySelectorAll('.dashboard-content').forEach(el => el.classList.add('hidden'));

            // Show Target
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                targetEl.classList.remove('hidden');

                // Fetch data if needed
                if (targetId === 'minions-view') {
                    loadMinions();
                }
            }
        });
    });
}

// --- MINIONS LOGIC ---
let minionsCache = null;

async function loadMinions() {
    const list = document.getElementById('minions-list');
    if (!list) return;

    // Use Cache if available
    if (minionsCache) {
        renderMinions(minionsCache);
        return;
    }

    list.innerHTML = '<p style="text-align:center; padding:2rem;">Chargement des mascottes...</p>';

    // Fetch from 'minions' table
    const { data, error } = await supabase
        .from('minions')
        .select('*')
        //.order('id', { ascending: true }) // Optional sorting
        .limit(100); // Limit for performance init

    if (error) {
        console.error('Error fetching minions:', error);
        list.innerHTML = '<p style="color:red; text-align:center;">Erreur de chargement ou table inexistante.</p>';
        return;
    }

    minionsCache = data;
    renderMinions(data);
}

function renderMinions(data) {
    const list = document.getElementById('minions-list');
    list.innerHTML = '';

    if (!data || data.length === 0) {
        list.innerHTML = '<p style="text-align:center; padding: 2rem;">Aucune mascotte trouvée dans la base.</p>';
        return;
    }

    data.forEach((minion, index) => {
        const row = document.createElement('div');
        // Determine patch styling
        // Try to handle numeric like 2.0 or just 2
        let patchMajor = '2';
        if (minion.patch) {
            const str = String(minion.patch);
            patchMajor = str.charAt(0);
        }

        row.className = `minion-row row-${patchMajor}`;
        row.style.animationDelay = `${index * 0.05}s`; // Staggered Animation

        const iconUrl = minion.icon || minion.image_url || 'https://xivapi.com/i/000000/000405.png';
        const name = minion.name || 'Inconnu';
        const patch = minion.patch || '?';

        row.innerHTML = `
            <img src="${iconUrl}" class="minion-icon" alt="${name}">
            <div class="minion-info">
                <div class="minion-name">${name}</div>
                <div class="minion-meta">
                    <span class="patch-badge patch-${patchMajor}">${patch}</span>
                    ${minion.patch_logo ? `<img src="${minion.patch_logo}" class="patch-logo">` : ''}
                    <div>⭐</div>
                </div>
            </div>
        `;
        list.appendChild(row);
    });
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
            const cy = Math.random() * 55 + 35;
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

function initAudioListeners() {
    const btn = document.getElementById('audio-toggle');
    if (btn) {
        btn.addEventListener('click', () => {
            if (audioState.isPlaying) {
                stopBgMusic();
            } else {
                startBgMusic();
                audioState.userInteracted = true;
            }
        });
    }
    document.addEventListener('click', () => {
        audioState.userInteracted = true;
    }, { once: true });
}

function startBgMusic() {
    if (audioState.isPlaying) return;
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
}

function stopBgMusic() {
    audioState.bgMusic.pause();
    audioState.isPlaying = false;
    updateAudioIcon(false);
}

function updateAudioIcon(isPlaying) {
    const icon = document.getElementById('audio-icon');
    if (icon) icon.textContent = isPlaying ? '🔊' : '🔇';
}

function handleLoginSound() {
    stopBgMusic();
    audioState.bgMusic.currentTime = 0;
    audioState.loginSound.play().catch(e => console.log("Login sound blocked", e));
}
