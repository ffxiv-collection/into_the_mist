import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase;
let currentUser = null; // Store current user for RLS operations
let userCollection = new Set(); // Store collected minion IDs

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
    const logo = document.querySelector('.logo-circle');

    if (session) {
        // --- LOGGED IN ---
        currentUser = session.user; // Update current user
        loginView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        if (audioBtn) audioBtn.style.display = 'none';

        // Logo: Corner
        if (logo) {
            logo.classList.remove('logo-center');
            logo.classList.add('logo-corner');
        }

        stopBgMusic();
        handleRouting();

    } else {
        // --- LOGGED OUT ---
        currentUser = null; // Clear user
        userCollection.clear(); // Clear local collection cache
        minionsCache = null; // Clear minions cache to force refresh on relogin

        loginView.classList.remove('hidden');
        dashboardView.classList.add('hidden');
        if (audioBtn) audioBtn.style.display = 'flex';

        // Logo: Center
        if (logo) {
            logo.classList.remove('logo-corner');
            logo.classList.add('logo-center');
        }

        fetchSprites();

        // Only start music if logout sound is NOT playing
        if (!audioState.logoutSoundPlaying) {
            startBgMusic();
        }
    }
}

// --- ROUTING LOGIC ---
function handleRouting() {
    const hash = window.location.hash.substring(1);
    let targetId = 'dashboard-home';
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
        if (targetId === 'minions') { // Note: ID in HTML is minions-view
            loadMinions();
        } else if (targetId === 'minions-view') {
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
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            // Logout Sequence
            if (audioState.logoutSound) {
                audioState.logoutSoundPlaying = true;

                audioState.logoutSound.currentTime = 0;
                audioState.logoutSound.play().catch(() => { });

                // When sound ends, start music
                audioState.logoutSound.onended = () => {
                    audioState.logoutSoundPlaying = false;
                    // Check if we are still on login screen (we should be)
                    // and audio is permitted
                    startBgMusic();
                };
            }

            // Log out immediately (triggers UI update)
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

    list.innerHTML = '<p style="text-align:center; padding:2rem;">Chargement des mascottes...</p>';

    // 1. Fetch User Collection (if logged in)
    if (currentUser) {
        const { data: userMinions, error: userError } = await supabase
            .from('user_minions')
            .select('minion_id')
            .eq('user_id', currentUser.id);

        if (!userError && userMinions) {
            userCollection = new Set(userMinions.map(row => row.minion_id));
        } else {
            console.error('Error fetching collection:', userError);
        }
    }

    // 2. Fetch Minions Data (Cache check handled below)
    let minionsData = minionsCache;

    if (!minionsData) {
        const { data, error } = await supabase
            .from('minions')
            .select(`
                *,
                patches (*),
                minion_sources (
                    details,
                    cost,
                    sources ( name, icon_source_url ),
                    currencies ( name, icon_currency_url )
                )
            `)
            .order('id', { ascending: true })
            .limit(100);

        if (error) {
            console.error('Error fetching minions:', error);
            list.innerHTML = `<p style="color:red; text-align:center;">Erreur de chargement: ${error.message}</p>`;
            return;
        }
        minionsCache = data;
        minionsData = data;
    }

    renderMinions(minionsData);
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
        if (minion.patches && !Array.isArray(minion.patches)) { patchData = minion.patches; }
        else if (Array.isArray(minion.patches) && minion.patches.length > 0) { patchData = minion.patches[0]; }

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

        // Check if collected
        const isCollected = userCollection.has(minion.id);
        const collectedClass = isCollected ? 'collected' : '';

        row.className = `minion-row row-${patchMajor} ${unavailableClass} ${collectedClass}`;
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
                    <div class="minion-name">
                        ${name}
                        ${minion.hôtel_des_ventes ? '<i class="fa-solid fa-gavel meta-icon-fa" title="Disponible à l\'hôtel des ventes"></i>' : ''}
                        ${minion.malle_surprise ? '<i class="fa-solid fa-box-open meta-icon-fa" title="Disponible dans une malle-surprise"></i>' : ''}
                        
                        ${/* NEW: Relational Sources */ ''}
                        ${(minion.minion_sources || []).map(ms => {
            const s = ms.sources;
            const c = ms.currencies;
            if (!s) return '';

            // Construct Tooltip: "Source: Details (Cost Currency)"
            // e.g., "Gold Saucer: Vendor (10000 MGP)"
            let tooltip = s.name;
            if (ms.details) tooltip += `: ${ms.details}`;
            if (ms.cost) {
                tooltip += ` (${ms.cost.toLocaleString()}${c ? ' ' + c.name : ''})`;
            }

            // ALIGNMENT FIX: Use icon_source_url
            const iconUrl = s.icon_source_url || '';
            const isImg = iconUrl.startsWith('http');

            const iconHtml = isImg
                ? `<img src="${iconUrl}" class="meta-icon-img" title="${tooltip}">`
                : `<i class="${iconUrl} meta-icon-fa" title="${tooltip}"></i>`;

            return (s.name === 'Boutique' && minion.shop_url)
                ? `<a href="${minion.shop_url}" target="_blank" class="shop-link">${iconHtml}</a>`
                : iconHtml;
        }).join('')}

                        ${/* LEGACY: Text Fallback */ ''}
                        ${minion.acquisition ? (() => {
                const text = minion.acquisition.toLowerCase();
                let iconClass = 'fa-circle-info'; // Default
                let title = minion.acquisition;

                if (text.includes('boutique') || text.includes('€') || text.includes('store')) iconClass = 'fa-cart-shopping';
                else if (text.includes('donjon') || text.includes('dungeon') || text.includes('raid') || text.includes('défi')) iconClass = 'fa-dungeon';
                else if (text.includes('quête') || text.includes('quest') || text.includes('épopée')) iconClass = 'fa-scroll';
                else if (text.includes('craft') || text.includes('artisanat') || text.includes('récolte')) iconClass = 'fa-hammer';
                else if (text.includes('haut fait') || text.includes('achievement')) iconClass = 'fa-trophy';
                else if (text.includes('événement') || text.includes('event')) iconClass = 'fa-calendar-star';
                else if (text.includes('pvp') || text.includes('jcj')) iconClass = 'fa-swords';

                const iconHtml = `<i class="fa-solid ${iconClass} meta-icon-fa" title="${minion.acquisition}"></i>`;

                return (minion.shop_url)
                    ? `<a href="${minion.shop_url}" target="_blank" class="shop-link">${iconHtml}</a>`
                    : iconHtml;
            })() : ''}
                    </div>
                    ${unavailableBadge}
                </div>
                <div class="minion-center-text">
                    ${minion.tooltip ? `"${minion.tooltip}"` : ''} 
                </div>
                
                <div class="minion-meta">
                    <div class="col-badge">${badgeHtml}</div>
                    <div class="col-logo">${logoHtml}</div>
                    <button class="btn-collect" aria-label="Ajouter à la collection">
                        <span class="star-icon">${isCollected ? '★' : '☆'}</span> 
                    </button>
                </div>
            </div>
        `;

        const btn = row.querySelector('.btn-collect');
        const star = btn.querySelector('.star-icon');

        // Toggle Collection
        btn.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent opening modal

            // Optimistic UI Update
            const newCollectedState = !row.classList.contains('collected');
            row.classList.toggle('collected');

            if (newCollectedState) {
                // COLLECTED
                star.textContent = '★';
                if (audioState.collectSound) {
                    audioState.collectSound.currentTime = 0;
                    audioState.collectSound.play().catch(() => { });
                }
                userCollection.add(minion.id);
            } else {
                // REMOVED
                star.textContent = '☆';
                if (audioState.uncollectSound) {
                    audioState.uncollectSound.currentTime = 0;
                    audioState.uncollectSound.play().catch(() => { });
                }
                userCollection.delete(minion.id);
            }

            // Sync with DB
            if (minion.id) toggleCollection(minion.id, newCollectedState);
        });

        // Open Modal on Row Click (except button)
        row.addEventListener('click', () => {
            openModal(minion, patchData);
        });

        list.appendChild(row);
    });
}

// --- MODAL LOGIC ---
function openModal(minion, patchData) {
    const modal = document.getElementById('details-modal');
    if (!modal) return;

    // Populate Data
    // Name, Tooltip & Image removed per user request

    // Info Grid (REMOVED per user request)
    // document.getElementById('modal-patch').textContent = patchData ? patchData.version : (minion.patch_id || '?');
    // document.getElementById('modal-available').textContent = minion.available !== false ? 'Oui' : 'Non';

    // Sources List
    const list = document.getElementById('modal-sources-list');
    list.innerHTML = '';

    const sources = minion.minion_sources || [];

    // Legacy fallback if no relational sources but acquisition text exists
    if (sources.length === 0 && minion.acquisition) {
        list.innerHTML = `
            <div class="source-item">
                <i class="fa-solid fa-circle-info source-icon-fa-large"></i>
                <div class="source-details">
                    <span class="source-name">Autre</span>
                    <span class="source-extra">${minion.acquisition}</span>
                </div>
            </div>
        `;
    }

    sources.forEach(ms => {
        const s = ms.sources;
        const c = ms.currencies;
        if (!s) return;

        // ALIGNMENT FIX: Use icon_source_url
        const iconUrl = s.icon_source_url || '';
        const isImg = iconUrl.startsWith('http');

        const iconHtml = isImg
            ? `<img src="${iconUrl}" class="source-icon-large">`
            : `<i class="${iconUrl} source-icon-fa-large"></i>`;

        let extra = ms.details || '';
        if (ms.cost) {
            extra += ` • ${ms.cost.toLocaleString()} ${c ? c.name : ''}`;
        }

        const div = document.createElement('div');
        div.className = 'source-item';
        div.innerHTML = `
            ${iconHtml}
            <div class="source-details">
                <span class="source-name">${s.name}</span>
                <span class="source-extra">${extra}</span>
            </div>
        `;

        // Link wrapper if Boutique
        if (s.name === 'Boutique' && minion.shop_url) {
            div.style.cursor = 'pointer';
            div.onclick = () => window.open(minion.shop_url, '_blank');
            div.title = "Ouvrir la boutique";
        }

        list.appendChild(div);
    });

    // Show Modal
    modal.classList.remove('hidden');
}

// Setup Modal Close
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('modal-close');
    const modal = document.getElementById('details-modal');

    if (closeBtn && modal) {
        closeBtn.onclick = () => modal.classList.add('hidden');
        modal.onclick = (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        }
    }
});

// --- DB SYNC ---
async function toggleCollection(minionId, isCollected) {
    if (!currentUser) {
        console.error("No current user!");
        return;
    }

    console.log(`Syncing Minion ${minionId}: ${isCollected ? 'INSERT' : 'DELETE'} for User ${currentUser.id}`);

    if (isCollected) {
        // INSERT
        const { data, error } = await supabase
            .from('user_minions')
            .insert([{ user_id: currentUser.id, minion_id: minionId }])
            .select(); // Best practice to return data to confirm integrity

        if (error) {
            console.error('Error adding minion:', error);
            alert(`Erreur de sauvegarde: ${error.message} (Code: ${error.code})`);
            // Optional: Revert UI here
        } else {
            console.log('Saved:', data);
        }
    } else {
        // DELETE
        const { error } = await supabase
            .from('user_minions')
            .delete()
            .eq('user_id', currentUser.id)
            .eq('minion_id', minionId);

        if (error) {
            console.error('Error removing minion:', error);
            alert(`Erreur de suppression: ${error.message}`);
        } else {
            console.log('Removed successfully');
        }
    }
}

// --- SPRITES LOGIC ---
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

    logoutSound: new Audio('https://res.cloudinary.com/dd4rdtrig/video/upload/v1765756694/FFXIV_Log_Out_vsa9ro.mp3'),
    collectSound: new Audio('https://res.cloudinary.com/dd4rdtrig/video/upload/v1765756662/FFXIV_Incoming_Tell_3_ait6dd.mp3'),
    uncollectSound: new Audio('https://res.cloudinary.com/dd4rdtrig/video/upload/v1765756644/FFXIV_Error_gvhk41.mp3'),

    isPlaying: false,
    userInteracted: false,
    logoutSoundPlaying: false
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
