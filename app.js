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

        updateUI(session);

        supabase.auth.onAuthStateChange((_event, session) => {
            updateUI(session);
        });

        setupEventListeners();

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
        loginView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        if (audioBtn) audioBtn.style.display = 'none';
        stopBgMusic();
        handleRouting();
    } else {
        loginView.classList.remove('hidden');
        dashboardView.classList.add('hidden');
        if (audioBtn) audioBtn.style.display = 'flex';
        fetchSprites();
        startBgMusic();
    }
}

// --- ROUTING LOGIC ---
function handleRouting() {
    const hash = window.location.hash.substring(1);
    const validRoutes = ['dashboard-home', 'minions-view', 'mounts-view', 'barding-view', 'orchestrion-view'];
    let targetId = 'dashboard-home';

    // Hash mapping
    const routeMap = {
        'home': 'dashboard-home',
        'minions': 'minions-view',
        'mounts': 'mounts-view',
        'bardings': 'barding-view',
        'orchestrion': 'orchestrion-view'
    };

    if (hash && routeMap[hash]) {
        targetId = routeMap[hash];
    }
    switchView(targetId);
}

function switchView(targetId) {
    const links = document.querySelectorAll('.nav-link');
    links.forEach(link => {
        link.classList.remove('active');
        const reverseMap = {
            'dashboard-home': 'Accueil',
            'minions-view': 'Mascottes',
            'mounts-view': 'Montures',
            'barding-view': 'Bardes',
            'orchestrion-view': 'Orchestion'
        };
        if (link.textContent.trim() === reverseMap[targetId]) {
            link.classList.add('active');
        }
    });

    document.querySelectorAll('.dashboard-content').forEach(el => el.classList.add('hidden'));
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
        targetEl.classList.remove('hidden');
        if (targetId === 'minions-view') {
            loadMinions();
        }
    }
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    initDashboardNav();

    window.addEventListener('hashchange', () => {
        const dashboardView = document.getElementById('dashboard-view');
        if (!dashboardView.classList.contains('hidden')) {
            handleRouting();
        }
    });

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
                handleLoginSound();
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            // Play Logout Sound
            if (audioState.logoutSound) {
                audioState.logoutSound.currentTime = 0;
                audioState.logoutSound.play().catch(() => { });
            }

            await supabase.auth.signOut();
            window.location.hash = '';
        });
    }
}

// --- DASHBOARD NAVIGATION ---
function initDashboardNav() {
    const links = document.querySelectorAll('.nav-link');
    const sectionHashes = {
        'Accueil': 'home',
        'Mascottes': 'minions',
        'Montures': 'mounts',
        'Bardes': 'bardings',
        'Orchestion': 'orchestrion'
    };

    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            // Play Menu Sound
            if (audioState.menuSound) {
                audioState.menuSound.currentTime = 0;
                audioState.menuSound.play().catch(() => { });
            }

            const text = link.textContent.trim();
            const hash = sectionHashes[text];
            if (hash) {
                window.location.hash = hash;
            }
        });
    });
}

// --- MINIONS LOGIC ---
let minionsCache = null;

async function loadMinions() {
    const list = document.getElementById('minions-list');
    if (!list) return;

    if (minionsCache) {
        renderMinions(minionsCache);
        return;
    }

    list.innerHTML = '<p style="text-align:center; padding:2rem;">Chargement des mascottes...</p>';

    const { data, error } = await supabase
        .from('minions')
        .select(`
            *,
            patches (*)
        `)
        .order('id', { ascending: true })
        .limit(100);

    if (error) {
        console.error('Error fetching minions:', error);
        list.innerHTML = `<p style="color:red; text-align:center;">Erreur de chargement: ${error.message}</p>`;
        return;
    }

    minionsCache = data;
    renderMinions(data);
}

function renderMinions(data) {
    const list = document.getElementById('minions-list');
    list.innerHTML = '';

    if (!data || data.length === 0) {
        list.innerHTML = '<p style="text-align:center; padding: 2rem;">Aucune mascotte trouvée.</p>';
        return;
    }

    data.forEach((minion, index) => {
        const row = document.createElement('div');

        let patchData = null;
        if (minion.patches && !Array.isArray(minion.patches)) {
            patchData = minion.patches;
        } else if (Array.isArray(minion.patches) && minion.patches.length > 0) {
            patchData = minion.patches[0];
        }

        let patchVersion = '?';
        let patchMajor = '2';

        if (patchData && patchData.version) {
            patchVersion = patchData.version;
            patchMajor = String(patchVersion).charAt(0);
        } else if (minion.patch_id) {
            patchVersion = minion.patch_id;
            patchMajor = String(minion.patch_id).charAt(0);
        }

        const isUnavailable = (minion.available === false);
        const unavailableClass = isUnavailable ? 'unavailable' : '';
        const unavailableBadge = isUnavailable ? '<span class="unavailable-tag" title="Indisponible en jeu">⛔ Indisponible</span>' : '';

        row.className = `minion-row row-${patchMajor} ${unavailableClass}`;
        row.style.animationDelay = `${index * 0.05}s`;

        const iconUrl = minion.icon_minion_url || 'https://xivapi.com/i/000000/000405.png';
        const name = minion.name || 'Inconnu';

        const patchIconUrl = patchData ? patchData.icon_patch_url : null;
        const patchLogoUrl = patchData ? patchData.logo_patch_url : null;

        let badgeHtml = '';
        if (patchIconUrl) {
            badgeHtml = `<img src="${patchIconUrl}" class="patch-badge-img" alt="${patchVersion}" title="Patch ${patchVersion}">`;
        } else {
            badgeHtml = `<span class="patch-badge patch-${patchMajor}">${patchVersion}</span>`;
        }

        let logoHtml = '';
        if (patchLogoUrl) {
            logoHtml = `<img src="${patchLogoUrl}" class="patch-logo" alt="Logo Patch">`;
        }

        row.innerHTML = `
            <img src="${iconUrl}" class="minion-icon" alt="${name}">
            <div class="minion-info">
                <div style="margin-right:auto;">
                    <div class="minion-name">${name}</div>
                    ${unavailableBadge}
                </div>
                
                <div class="minion-meta">
                    <div class="col-badge">${badgeHtml}</div>
                    <div class="col-logo">${logoHtml}</div>
                    <div class="col-market">
                        ${minion.hôtel_des_ventes ? '<span class="meta-icon" title="Vendable">💰</span>' : ''}
                        ${minion.malle_surprise ? '<span class="meta-icon" title="Malle Surprise">🎁</span>' : ''}
                    </div>
                    <button class="btn-collect" aria-label="Ajouter à la collection">
                        <span class="star-icon">☆</span> 
                    </button>
                </div>
            </div>
        `;

        const btn = row.querySelector('.btn-collect');
        const star = btn.querySelector('.star-icon');

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            row.classList.toggle('collected');

            const isCollected = row.classList.contains('collected');

            if (isCollected) {
                // COLLECTED (Success)
                star.textContent = '★';
                if (audioState.collectSound) {
                    audioState.collectSound.currentTime = 0;
                    audioState.collectSound.play().catch(() => { });
                }
            } else {
                // REMOVED (Error/Cancel)
                star.textContent = '☆';
                if (audioState.uncollectSound) {
                    audioState.uncollectSound.currentTime = 0;
                    audioState.uncollectSound.play().catch(() => { });
                }
            }
        });

        list.appendChild(row);
    });
}

// --- SPRITES LOGIC ---
async function fetchSprites() {
    const container = document.getElementById('supabase-data');
    if (!container) return;
    if (container.children.length > 0) return;

    const { data, error } = await supabase.from('sprites').select('*');
    if (error || !data) return;

    const placedPositions = placedPositions || [];
    container.innerHTML = '';

    data.forEach((spriteData, index) => {
        const sprite = document.createElement('div');
        sprite.className = 'floating-sprite';
        const url = spriteData.icon_sprite_url;
        if (!url) return;
        sprite.style.backgroundImage = `url('${url}')`;

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
    if (!existingPositions) return false;
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
    menuSound: new Audio('https://res.cloudinary.com/dd4rdtrig/video/upload/v1765756639/FFXIV_Confirm_k4wbeb.mp3'),

    // NEW SOUNDS
    logoutSound: new Audio('https://res.cloudinary.com/dd4rdtrig/video/upload/v1765756694/FFXIV_Log_Out_vsa9ro.mp3'),
    collectSound: new Audio('https://res.cloudinary.com/dd4rdtrig/video/upload/v1765756662/FFXIV_Incoming_Tell_3_ait6dd.mp3'),
    uncollectSound: new Audio('https://res.cloudinary.com/dd4rdtrig/video/upload/v1765756644/FFXIV_Error_gvhk41.mp3'),

    isPlaying: false,
    userInteracted: false
};

// Volumes
audioState.bgMusic.loop = true;
audioState.bgMusic.volume = 0.5;
audioState.loginSound.volume = 0.6;
audioState.menuSound.volume = 0.6;
audioState.logoutSound.volume = 0.6;
audioState.collectSound.volume = 0.5;
audioState.uncollectSound.volume = 0.5;

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
