import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase;
let currentUser = null; // Store current user for RLS operations
let userCollection = new Set(); // Store collected minion IDs
let userMountCollection = new Set(); // Store collected mount IDs

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

        // Init Theme
        initTheme();

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

    // SCROLL SAVE
    window.addEventListener('beforeunload', () => {
        localStorage.setItem('pageScroll', window.scrollY);
    });
});

// --- UI UPDATES ---
function updateUI(session) {
    // OPTIMIZATION: If user is already set and same as session, DO NOT re-render
    // This prevents scroll reset on tab switch / token refresh
    if (currentUser && session && currentUser.id === session.user.id) {
        // Just update the object reference, don't touch DOM
        currentUser = session.user;
        return;
    }

    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    const audioBtn = document.getElementById('audio-toggle');
    const logo = document.querySelector('.logo-circle');

    if (session) {
        // --- LOGGED IN ---
        const isNewLogin = (currentUser === null);
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

        // AUTO-SYNC on fresh login/load
        if (isNewLogin) {
            console.log("Auto-syncing collection...");
            syncMinions(true); // Silent mode
            syncMounts(true);  // Silent mode
        }

    } else {
        // --- LOGGED OUT ---
        currentUser = null; // Clear user
        userCollection.clear(); // Clear local collection cache
        userMountCollection.clear(); // Clear mounts cache
        minionsCache = null; // Clear minions cache to force refresh on relogin
        mountsCache = null; // Clear mounts cache

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
    } else if (hash.startsWith('minion/')) {
        targetId = 'minion-detail-view';
        const minionId = hash.split('/')[1];
        showMinionDetails(minionId);
    } else if (hash.startsWith('mount/')) {
        targetId = 'mount-detail-view';
        const mountId = hash.split('/')[1];
        showMountDetails(mountId);
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
        } else if (targetId === 'minion-detail-view') {
            // Ensure minions are loaded if deep linking
            if (!minionsCache) loadMinions();
        } else if (targetId === 'mounts-view') {
            loadMounts();
        } else if (targetId === 'mount-detail-view') {
            if (!mountsCache) loadMounts();
        }
    }
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    initDashboardNav();

    // Back Button for Details
    const btnBack = document.getElementById('btn-back-minions');
    if (btnBack) {
        btnBack.addEventListener('click', () => {
            window.location.hash = 'minions';
        });
    }

    // Back Button for Mounts
    const btnBackMounts = document.getElementById('btn-back-mounts');
    if (btnBackMounts) {
        btnBackMounts.addEventListener('click', () => {
            window.location.hash = 'mounts';
        });
    }

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
                    lodestone_url,
                    location,
                    created_at,
                    sources ( name, icon_source_url ),
                    currencies ( name, icon_currency_url )
                )
            `)
            .order('name', { ascending: true })
            .limit(1000);

        if (error) {
            console.error('Error fetching minions:', error);
            list.innerHTML = `<p style="color:red; text-align:center;">Erreur de chargement: ${error.message}</p>`;
            return;
        }
        minionsCache = data;
        minionsData = data;
    }

    renderMinions(minionsData);

    // SCROLL RESTORE
    const savedScroll = localStorage.getItem('pageScroll');
    if (savedScroll && window.location.hash.includes('minions')) {
        setTimeout(() => {
            window.scrollTo(0, parseInt(savedScroll));
        }, 100);
    }
}


// --- FILTER LOGIC ---
let activeFilters = {
    collection: null, // 'collected' | 'missing' | null
    collection: null, // 'collected' | 'missing' | null
    patch: null, // '2', '3', ... | null
    search: '' // Search query string
};

function setupFilterListeners() {
    const filterBar = document.querySelector('.filter-bar');
    if (!filterBar || filterBar.dataset.init === 'true') return;
    filterBar.dataset.init = 'true';

    // Collection Filters
    filterBar.querySelectorAll('.btn-star-unified').forEach(btn => {
        btn.addEventListener('click', () => {
            const filterType = btn.dataset.filter;
            if (activeFilters.collection === filterType) {
                activeFilters.collection = null;
                btn.classList.remove('active');
            } else {
                activeFilters.collection = filterType;
                filterBar.querySelectorAll('.btn-filter-icon').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
            renderMinions(minionsCache);
        });
    });

    // Patch Filters
    const patchContainer = filterBar.querySelector('.patch-filters');
    if (patchContainer) {
        patchContainer.querySelectorAll('.btn-patch-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                const patchVer = btn.dataset.patch;
                if (activeFilters.patch === patchVer) {
                    activeFilters.patch = null;
                    btn.classList.remove('active');
                } else {
                    activeFilters.patch = patchVer;
                    patchContainer.querySelectorAll('.btn-patch-filter').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                }
                renderMinions(minionsCache);
            });
        });
    }

    // Search Input
    const searchInput = document.getElementById('minion-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            activeFilters.search = e.target.value.trim().toLowerCase();
            renderMinions(minionsCache);
        });
    }

    // Reset
    const resetBtn = document.getElementById('filter-reset');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            activeFilters = { collection: null, patch: null, search: '' };
            if (searchInput) searchInput.value = ''; // Clear input
            filterBar.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
            renderMinions(minionsCache);
        });
    }

    // Sync Button
    const syncBtn = document.getElementById('btn-sync');
    if (syncBtn) {
        syncBtn.addEventListener('click', () => {
            if (!currentUser) {
                alert("Veuillez vous connecter pour synchroniser votre collection.");
                return;
            }
            syncMinions();
        });
    }
}

// --- SYNC WITH FFXIV COLLECT ---
async function syncMinions(silent = false) {
    const syncBtn = document.getElementById('btn-sync');
    if (syncBtn && !silent) {
        syncBtn.disabled = true;
        syncBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sync...';
    }

    try {
        // 1. Get Character ID
        const { data: charData, error: charError } = await supabase
            .from('characters')
            .select('character_id')
            .eq('user_id', currentUser.id)
            .single();

        if (charError || !charData) {
            if (!silent) {
                console.error('Character fetch error:', charError);
                alert("Aucun personnage lié trouvé. Veuillez lier votre personnage dans les paramètres (à venir) ou contacter l'admin.");
            }
            throw new Error("No character linked");
        }

        const charId = charData.character_id;
        console.log(`Syncing for character ID: ${charId}`);

        // 2. Fetch from FFXIV Collect API
        const response = await fetch(`https://ffxivcollect.com/api/characters/${charId}/minions/owned`);
        if (!response.ok) throw new Error("API FFXIV Collect Error");

        const ownedData = await response.json();
        // The API returns an array of minion objects: [{ id: 123, name: "..." }, ...]
        const apiOwnedIds = new Set(ownedData.map(m => m.id));

        console.log(`API reports ${apiOwnedIds.size} minions owned.`);

        // 3. Fetch Local Minion Map (FFXIV ID -> Local ID)
        // We need to know which local ID corresponds to the API ID
        const { data: allMinions, error: mapError } = await supabase
            .from('minions')
            .select('id, ffxiv_collect_id')
            .not('ffxiv_collect_id', 'is', null);

        if (mapError) throw mapError;

        const ffxivMap = new Map(); // Key: API ID, Value: Local DB ID
        allMinions.forEach(m => {
            ffxivMap.set(m.ffxiv_collect_id, m.id);
        });

        // 4. Find Missing Minions (Differential)
        const minionsToAdd = [];

        for (const apiId of apiOwnedIds) {
            const localDbId = ffxivMap.get(apiId);

            // Only proceed if we have this minion in our local DB
            if (localDbId) {
                // Check if user already has this LOCAL ID collected
                if (!userCollection.has(localDbId)) {
                    minionsToAdd.push({
                        user_id: currentUser.id,
                        minion_id: localDbId
                    });
                }
            }
        }

        console.log(`Found ${minionsToAdd.length} new minions to add.`);

        if (minionsToAdd.length === 0) {
            if (!silent) alert("Votre collection est déjà à jour !");
        } else {
            // 5. Bulk Insert
            const { error: insertError } = await supabase
                .from('user_minions')
                .insert(minionsToAdd);

            if (insertError) {
                console.error("Bulk insert error:", insertError);
                // Duplicate key error might happen if race condition, but differential check minimizes it.
                // We'll treat it as partial success or error.
                if (insertError.code === '23505') { // Unique violation
                    if (!silent) alert("Certaines mascottes étaient déjà en cours d'ajout. Veuillez rafraîchir.");
                } else {
                    throw insertError;
                }
            } else {
                // Success: Add to local set and re-render
                minionsToAdd.forEach(item => userCollection.add(item.minion_id));
                renderMinions(minionsCache);

                // Play sound regardless of silent mode (User Request)
                playCollectSound();

                if (!silent) {
                    alert(`Succès ! ${minionsToAdd.length} nouvelles mascottes ajoutées.`);
                } else {
                    // Silent mode: No alert, but sound played.
                    console.log(`Auto-sync added ${minionsToAdd.length} minions.`);
                }
            }
        }

    } catch (err) {
        console.error("Sync failed:", err);
        if (!silent && err.message !== "No character linked") {
            alert("Erreur lors de la synchronisation : " + err.message);
        }
    } finally {
        if (syncBtn && !silent) {
            syncBtn.disabled = false;
            syncBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Sync';
        }
    }
}

// --- SYNC MOUNTS ---
async function syncMounts(silent = false) {
    const syncBtn = document.getElementById('btn-sync-mounts');
    if (syncBtn && !silent) {
        syncBtn.disabled = true;
        syncBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sync...';
    }

    try {
        // 1. Get Character ID
        const { data: charData, error: charError } = await supabase
            .from('characters')
            .select('character_id')
            .eq('user_id', currentUser.id)
            .single();

        if (charError || !charData) {
            if (!silent) {
                console.error('Character fetch error:', charError);
                alert("Aucun personnage lié trouvé. Veuillez lier votre personnage ou contacter l'admin.");
            }
            throw new Error("No character linked");
        }

        const charId = charData.character_id;
        console.log(`Syncing Mounts for character ID: ${charId}`);

        // 2. Fetch from FFXIV Collect API
        const response = await fetch(`https://ffxivcollect.com/api/characters/${charId}/mounts/owned`);
        if (!response.ok) throw new Error("API FFXIV Collect Error");

        const ownedData = await response.json();
        const apiOwnedIds = new Set(ownedData.map(m => m.id));

        console.log(`API reports ${apiOwnedIds.size} mounts owned.`);

        // 3. Fetch Local Mount Map (FFXIV ID -> Local ID)
        const { data: allMounts, error: mapError } = await supabase
            .from('mounts')
            .select('id, ffxiv_collect_id')
            .not('ffxiv_collect_id', 'is', null);

        if (mapError) throw mapError;

        const ffxivMap = new Map();
        allMounts.forEach(m => {
            ffxivMap.set(m.ffxiv_collect_id, m.id);
        });

        // 4. Find Missing Mounts
        const mountsToAdd = [];

        for (const apiId of apiOwnedIds) {
            const localDbId = ffxivMap.get(apiId);
            if (localDbId) {
                if (!userMountCollection.has(localDbId)) {
                    mountsToAdd.push({
                        user_id: currentUser.id,
                        mount_id: localDbId
                    });
                }
            }
        }

        console.log(`Found ${mountsToAdd.length} new mounts to add.`);

        if (mountsToAdd.length === 0) {
            if (!silent) alert("Votre collection de montures est déjà à jour !");
        } else {
            // 5. Bulk Insert
            const { error: insertError } = await supabase
                .from('user_mounts')
                .insert(mountsToAdd);

            if (insertError) {
                console.error("Bulk insert error:", insertError);
                if (insertError.code === '23505') {
                    if (!silent) alert("Certaines montures étaient déjà en cours d'ajout.");
                } else {
                    throw insertError;
                }
            } else {
                mountsToAdd.forEach(item => userMountCollection.add(item.mount_id));

                // Only re-render if we are on mounts view
                const mountsView = document.getElementById('mounts-view');
                if (mountsView && !mountsView.classList.contains('hidden')) {
                    renderMounts(mountsCache);
                }

                playCollectSound();

                if (!silent) {
                    alert(`Succès ! ${mountsToAdd.length} nouvelles montures ajoutées.`);
                } else {
                    console.log(`Auto-sync added ${mountsToAdd.length} mounts.`);
                }
            }
        }

    } catch (err) {
        console.error("Sync Mounts failed:", err);
        if (!silent && err.message !== "No character linked") {
            alert("Erreur lors de la synchronisation : " + err.message);
        }
    } finally {
        if (syncBtn && !silent) {
            syncBtn.disabled = false;
            syncBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Sync';
        }
    }
}

function renderMinions(data) {
    const list = document.getElementById('minions-list');
    list.innerHTML = '';

    // Apply Filter Logic
    let filteredData = data;
    if (activeFilters.collection || activeFilters.patch || activeFilters.search) {
        filteredData = data.filter(minion => {
            // Collection Filter
            if (activeFilters.collection === 'collected') {
                if (!userCollection.has(minion.id)) return false;
            } else if (activeFilters.collection === 'missing') {
                if (userCollection.has(minion.id)) return false;
            }

            // Patch Filter
            let pVer = '2.0';
            if (minion.patches && minion.patches.version) pVer = String(minion.patches.version);
            else if (minion.patch_id) pVer = String(minion.patch_id);

            if (activeFilters.patch) {
                if (!pVer.startsWith(activeFilters.patch)) return false;
            }

            // Search Filter
            if (activeFilters.search) {
                const name = (minion.name || '').toLowerCase();
                if (!name.includes(activeFilters.search)) return false;
            }

            return true;
        });
    }

    if (!filteredData || filteredData.length === 0) {
        list.innerHTML = '<p style="text-align:center; padding: 2rem; color: #888;">Aucune mascotte ne correspond aux filtres.</p>';
        return;
    }

    // Ensure listeners are set up
    setupFilterListeners();

    // Intersection Observer
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('scroll-visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    const fragment = document.createDocumentFragment();

    filteredData.forEach((minion, index) => {
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
        const isCollected = userCollection.has(minion.id);
        const collectedClass = isCollected ? 'collected' : '';

        // --- ROW ELEMENT (DOM) ---
        const row = document.createElement('div');
        row.className = `minion-row row-${patchMajor} ${unavailableClass} ${collectedClass}`;
        row.style.animationDelay = `${index * 0.05}s`;

        // Open Details Page Listener -> REMOVED ON ROW
        // row.dataset.id = minion.id;
        // row.style.cursor = 'default';

        observer.observe(row);

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
        let logoHtml = patchLogoUrl ? `<img src="${patchLogoUrl}" class="patch-logo" alt="Logo Patch">` : '';

        // Sources Icons
        let shopIconRendered = false;

        const sourceIconsHtml = (minion.minion_sources || []).map(ms => {
            const s = ms.sources;
            const c = ms.currencies;
            if (!s) return '';
            if (ms.lodestone_url) return ''; // Hide official

            let tooltip = s.name;
            if (ms.details) tooltip += `: ${ms.details}`;
            if (ms.cost) {
                tooltip += ` (${ms.cost.toLocaleString()}${c ? ' ' + c.name : ''})`;
            }

            const iconSrc = s.icon_source_url || '';
            const isImg = iconSrc.startsWith('http');
            let iconHtml = '';

            // LOGIC: If source is explicitly a Shop type (Boutique/CDJapan), use Cart Icon
            // And mark that we rendered the shop button.
            if (s.name && (s.name.toLowerCase().includes('boutique') || s.name.toLowerCase().includes('cdjapan'))) {
                if (minion.shop_url) {
                    shopIconRendered = true;
                    iconHtml = `<i class="fa-solid fa-cart-shopping meta-icon-fa" title="${tooltip}"></i>`;
                    return `<a href="${minion.shop_url}" target="_blank" class="shop-link" onclick="event.stopPropagation()">${iconHtml}</a>`;
                } else {
                    // Shop source but no URL? Show cart but not clickable? Or fallback?
                    // User said "if no link, don't show icon" (Step 3012).
                    // So if Boutique with no URL -> Return empty?
                    // "S'il n'y a pas de lien, il ne faut pas afficher l'icone"
                    return '';
                }
            }

            // Standard Source Logic
            if (isImg) return '';
            if (!iconSrc) return '';
            iconHtml = `<i class="${iconSrc} meta-icon-fa" title="${tooltip}"></i>`;
            return iconHtml;
        }).join('');

        // FALLBACK: If we have a Shop URL but no "Shop Source" rendered it (e.g. Bébé Bahamut)
        // We append a standalone Cart Icon.
        const standaloneShopHtml = (minion.shop_url && !shopIconRendered)
            ? `<a href="${minion.shop_url}" target="_blank" class="shop-link" onclick="event.stopPropagation()"><i class="fa-solid fa-cart-shopping meta-icon-fa" title="Acheter en ligne"></i></a>`
            : '';

        // Legacy Acquisition fallback
        const acquisitionText = minion.acquisition ? (() => {
            const text = minion.acquisition.toLowerCase();
            let iconClass = 'fa-circle-info';
            if (text.includes('boutique') || text.includes('€') || text.includes('store')) iconClass = 'fa-cart-shopping';
            else if (text.includes('donjon') || text.includes('dungeon')) iconClass = 'fa-dungeon';
            else if (text.includes('quête') || text.includes('quest')) iconClass = 'fa-scroll';
            else if (text.includes('craft') || text.includes('artisanat')) iconClass = 'fa-hammer';
            else if (text.includes('haut fait') || text.includes('achievement')) iconClass = 'fa-trophy';
            else if (text.includes('événement') || text.includes('event')) iconClass = 'fa-calendar-star';
            else if (text.includes('pvp') || text.includes('jcj')) iconClass = 'fa-swords';

            const iconHtml = `<i class="fa-solid ${iconClass} meta-icon-fa" title="${minion.acquisition}"></i>`;
            return (minion.shop_url)
                ? `<a href="${minion.shop_url}" target="_blank" class="shop-link">${iconHtml}</a>`
                : iconHtml;
        })() : '';

        // --- ROW INNER HTML (Safe static parts) ---
        row.innerHTML = `
            <img src="${iconUrl}" class="minion-icon" alt="${name}">
            <div class="minion-info">
                <div style="margin-right:auto; display:flex; flex-direction:column; align-items:flex-start;">
                    <span class="minion-name">
                            <span class="minion-name-link" onclick="window.location.hash='minion/${minion.id}'; event.stopPropagation();">${name}</span>
                            <button class="btn-sources-trigger" title="Infos & Sources"><i class="fa-solid fa-magnifying-glass"></i></button>
                            ${minion.hôtel_des_ventes ? '<i class="fa-solid fa-gavel meta-icon-fa" title="Disponible à l\'hôtel des ventes"></i>' : ''}
                            ${minion.malle_surprise ? '<i class="fa-solid fa-box-open meta-icon-fa" title="Disponible dans une malle-surprise"></i>' : ''}
                            ${sourceIconsHtml}
                            ${standaloneShopHtml}
                            ${sourceIconsHtml === '' && standaloneShopHtml === '' ? acquisitionText : ''}
                    </span>
                </div>
            </div>
            
            <div class="minion-center-text" title="${minion.tooltip ? minion.tooltip.replace(/"/g, '&quot;') : ''}">
                ${minion.tooltip ? `<i class="fa-solid fa-quote-left quote-icon"></i> ${minion.tooltip} <i class="fa-solid fa-quote-right quote-icon"></i>` : ''} 
            </div>
            
            <div class="minion-meta">
                <div class="col-badge">${badgeHtml}</div>
                <div class="col-logo">${logoHtml}</div>
                <div class="btn-collect-container"></div>
            </div>
        `;

        // --- INTERACTIVITY: Manual Attachments ---

        // 1. Source Button
        const btnSources = row.querySelector('.btn-sources-trigger');
        if (btnSources) {
            btnSources.addEventListener('click', (e) => {
                e.stopPropagation();
                openModal(minion, patchData);
            });
        }

        // 2. Collection Button
        const btnContainer = row.querySelector('.btn-collect-container');
        const btnCollect = document.createElement('button');
        btnCollect.className = isCollected ? 'btn-star-unified collected' : 'btn-star-unified';
        btnCollect.title = "Ajouter à ma collection";
        btnCollect.innerHTML = isCollected
            ? '<i class="fa-solid fa-star"></i>'
            : '<i class="fa-regular fa-star"></i>';

        btnCollect.addEventListener('click', (e) => {
            e.stopPropagation();
            // Toggle Logic
            const wasCollected = row.classList.contains('collected');
            if (wasCollected) {
                userCollection.delete(minion.id);
                row.classList.remove('collected');
                // Switch to Empty Star
                btnCollect.classList.remove('collected');
                btnCollect.innerHTML = '<i class="fa-regular fa-star"></i>';
                playUncollectSound();
                toggleCollection(minion.id, false);
            } else {
                userCollection.add(minion.id);
                row.classList.add('collected');
                // Switch to Full Star
                btnCollect.classList.add('collected');
                btnCollect.innerHTML = '<i class="fa-solid fa-star"></i>';
                playCollectSound();
                toggleCollection(minion.id, true);
            }
        });

        btnContainer.appendChild(btnCollect);
        fragment.appendChild(row);
    });

    list.appendChild(fragment);
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

    const sources = (minion.minion_sources || []).sort((a, b) => {
        return new Date(a.created_at) - new Date(b.created_at);
    });

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

    // Sort sources by ID (Creation Order)
    if (sources) {
        sources.sort((a, b) => (a.id || 0) - (b.id || 0));
    }

    // Toggle 2-column layout only if more than 1 source
    if (sources && sources.length > 1) {
        list.classList.add('has-multiple-sources');
    } else {
        list.classList.remove('has-multiple-sources');
    }

    sources.forEach(ms => {
        const s = ms.sources;
        const c = ms.currencies;

        if (!s) return;

        // ALIGNMENT FIX: Use icon_source_url
        let iconUrl = s.icon_source_url || '';

        // Dark Mode Logic for CDJapan
        if (s.name === 'CDJapan') {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            if (isDark) {
                iconUrl = 'https://res.cloudinary.com/dd4rdtrig/image/upload/v1766262130/cdjapan_logo_blanc_vrpgph.png';
            }
        }

        // Dark Mode Logic for Square Enix Boutique
        if (s.name === 'Square Enix Boutique') {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            if (isDark) {
                iconUrl = 'https://res.cloudinary.com/dd4rdtrig/image/upload/v1765935529/square_enix_boutique_blanc_mbqtdy.webp';
            }
        }

        const iconUrlFinal = iconUrl;
        const isImg = iconUrlFinal.startsWith('http');

        const iconHtml = isImg
            ? `<img src="${iconUrlFinal}" class="source-icon-large">`
            : `<i class="${iconUrl} source-icon-fa-large"></i>`;

        // Right Column: Cost
        let costHtml = '';
        if (ms.cost && ms.cost > 0) {
            const currencyVal = (c && c.icon_currency_url) ? c.icon_currency_url : '';

            let currencyHtml = '';
            if (currencyVal.startsWith('http')) {
                currencyHtml = `<img src="${currencyVal}" class="currency-icon-img" title="${c ? c.name : ''}">`;
            } else if (currencyVal.startsWith('fa-')) {
                currencyHtml = `<i class="${currencyVal} currency-icon-fa"></i>`;
            } else {
                // Text symbol fallback (e.g. "€")
                currencyHtml = `<span class="currency-symbol">${currencyVal}</span>`;
            }

            costHtml = `
                <div class="source-cost">
                    <span class="cost-value">${currencyVal === '€' || (c && c.name === 'Euro')
                    ? ms.cost.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : ms.cost.toLocaleString()}</span>
                    ${currencyHtml}
                </div>
            `;
        }

        const div = document.createElement('div');
        div.className = 'source-item';

        // Prepare Title and Details
        let sourceTitleHtml = `<span class="source-title">${s.name}</span>`;
        let sourceDetailsHtml = ms.details ? `<span class="source-details">${ms.details}</span>` : '';

        // Apply Lodestone Link
        // Rule: If details exists -> Link details. If details EMPTY -> Link Title.
        if (ms.lodestone_url && ms.lodestone_url.trim() !== '') {
            const hasDetails = ms.details && ms.details.trim() !== '';

            if (hasDetails) {
                sourceDetailsHtml = `<a href="${ms.lodestone_url}" class="eorzeadb_link source-details" target="_blank">${ms.details}</a>`;
            } else {
                sourceTitleHtml = `<a href="${ms.lodestone_url}" class="eorzeadb_link source-title" target="_blank">${s.name}</a>`;
            }
        }

        div.innerHTML = `
            ${iconHtml}
            <div class="source-info">
                ${sourceTitleHtml}
                ${sourceDetailsHtml}
                ${ms.location ? `<span style="font-weight:bold; font-size:0.85rem;">${ms.location}</span>` : ''}
                ${minion.reputation_rank ? `<span style="font-size:0.85rem;">${minion.reputation_rank}</span>` : ''}
            </div>
            ${costHtml}
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
// ------------------------------------------------------------------
// THEME LOGIC
// ------------------------------------------------------------------
function initTheme() {
    const themeBtn = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');

    // Check Storage -> System Preference
    const savedTheme = localStorage.getItem('theme');
    let isDark = false;

    if (savedTheme) {
        isDark = (savedTheme === 'dark');
    } else {
        isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    applyTheme(isDark);

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newIsDark = (currentTheme !== 'dark');
            applyTheme(newIsDark);
        });
    }
}

function applyTheme(isDark) {
    const root = document.documentElement;
    const themeIcon = document.getElementById('theme-icon');
    const mainLogo = document.getElementById('main-logo');

    // Logos
    const logoLight = "https://res.cloudinary.com/dd4rdtrig/image/upload/v1765754698/ffxiv_logo_black_text_patch_7.0_pgijf1.png";
    const logoDark = "https://res.cloudinary.com/dd4rdtrig/image/upload/v1766244166/ffxiv_logo_white_text_patch_7.0_onh610.png";

    if (isDark) {
        root.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        if (themeIcon) themeIcon.textContent = '☀️';
        if (mainLogo) mainLogo.src = logoDark;
    } else {
        root.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
        if (themeIcon) themeIcon.textContent = '🌙';
        if (mainLogo) mainLogo.src = logoLight;
    }
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

function playCollectSound() {
    if (audioState.collectSound) {
        audioState.collectSound.currentTime = 0;
        audioState.collectSound.play().catch(() => {
            // Autoplay policy might block this if no user interaction yet.
        });
    }
}

function playUncollectSound() {
    if (audioState.uncollectSound) {
        audioState.uncollectSound.currentTime = 0;
        audioState.uncollectSound.play().catch(() => { });
    }
}

// --- DETAIL VIEW LOGIC ---
function showMinionDetails(id) {
    // If cache not loaded yet, wait slightly or handle (loadMinions called in switchView covers it partially)
    // But if we come directly, cache might be empty.

    // Retry logic if cache empty
    if (!minionsCache) {
        setTimeout(() => showMinionDetails(id), 200);
        return;
    }

    const minion = minionsCache.find(m => String(m.id) === String(id));
    if (!minion) {
        console.error("Minion not found for details:", id);
        window.location.hash = 'minions';
        return;
    }

    // Populate Data
    const nameEl = document.getElementById('detail-name');
    const imgEl = document.getElementById('detail-img');
    const diaryEl = document.getElementById('detail-diary-text');
    const patchLogoEl = document.getElementById('detail-patch-logo');
    const patchVerEl = document.getElementById('detail-patch-ver');
    const sourcesEl = document.getElementById('detail-sources');

    if (nameEl) {
        nameEl.textContent = minion.name || 'Inconnu';
        // Apply Patch Color using class manipulation
        // Need patch major
        let pMajor = '2';
        if (minion.patches && minion.patches.version) pMajor = String(minion.patches.version).charAt(0);
        else if (minion.patch_id) pMajor = String(minion.patch_id).charAt(0);

        // Reset classes
        nameEl.className = '';
        nameEl.classList.add(`text-patch-${pMajor}`);
        // Ensure gradient is removed/overridden if conflicting
        nameEl.style.background = 'none';
        nameEl.style.webkitTextFillColor = 'initial';

        // Apply Global Patch Theme to container
        const detailContainer = document.getElementById('minion-detail-view');
        if (detailContainer) {
            // Remove old theme classes
            detailContainer.classList.remove('theme-patch-2', 'theme-patch-3', 'theme-patch-4', 'theme-patch-5', 'theme-patch-6', 'theme-patch-7', 'theme-patch-default');
            // Add new
            detailContainer.classList.add(`theme-patch-${pMajor}`);
        }
    }

    // Image: Use picture_minion_url (Large) or fallback to icon
    if (imgEl) {
        const largeImg = minion.picture_minion_url || minion.image_url || minion.icon_minion_url;
        imgEl.src = largeImg;
        imgEl.alt = minion.name;
    }

    // Diary
    if (diaryEl) {
        let text = minion.diary || minion.description || "Aucune description dans le carnet.";
        // Fix for potential HTML in description or newlines
        // If text contains HTML tags (rare but possible), stripping them or using innerHTML might be safer?
        // For now textContent is safer.
        diaryEl.textContent = text;
    }

    // Patch
    let patchData = null;
    if (minion.patches && !Array.isArray(minion.patches)) { patchData = minion.patches; }
    else if (Array.isArray(minion.patches) && minion.patches.length > 0) { patchData = minion.patches[0]; }

    if (patchLogoEl && patchVerEl) {
        if (patchData) {
            patchVerEl.textContent = `Patch ${patchData.version}`;
            if (patchData.logo_patch_url) {
                patchLogoEl.src = patchData.logo_patch_url;
                patchLogoEl.style.display = 'block';
            } else {
                patchLogoEl.style.display = 'none';
            }
        } else {
            patchVerEl.textContent = minion.patch_id ? `Patch ${minion.patch_id}` : 'Patch Inconnu';
            patchLogoEl.style.display = 'none';
        }
    }

    // Sources Logic (Duplicated from render logic roughly)
    if (sourcesEl) {
        sourcesEl.innerHTML = '';
        // Sort by ID for chronological order
        const sources = (minion.minion_sources || []).sort((a, b) => (a.id || 0) - (b.id || 0));

        // Toggle 2-column layout
        if (sources.length > 1) {
            sourcesEl.classList.add('has-multiple-sources');
        } else {
            sourcesEl.classList.remove('has-multiple-sources');
        }

        if (sources.length === 0 && minion.acquisition) {
            sourcesEl.innerHTML = `<div class="source-item"><span class="source-name">${minion.acquisition}</span></div>`;
        } else {
            sources.forEach(ms => {
                const s = ms.sources;
                const c = ms.currencies;
                if (!s) return;

                let iconUrl = s.icon_source_url || '';

                let extraInfos = [];
                // Details first
                if (ms.details) extraInfos.push(`<span class="source-extra-info">${ms.details}</span>`);

                // Location on new line (using div or block)
                if (ms.location) {
                    extraInfos.push(`<span class="source-extra-info" style="display:block;"><i class="fa-solid fa-map-pin"></i> ${ms.location}</span>`);
                }

                let detailsHtml = extraInfos.join('');

                // Reputation Rank from Minion Table
                let repHtml = '';
                if (minion.reputation_rank) {
                    repHtml = `<span class="source-extra-info" style="display:block;"><i class="fa-solid fa-medal"></i> ${minion.reputation_rank}</span>`;
                }

                let costHtml = '';
                if (ms.cost) {
                    // Check for currency icon
                    let currencyIcon = '';
                    if (c && c.icon_currency_url) {
                        const iconVal = c.icon_currency_url;
                        if (iconVal.startsWith('http') || iconVal.startsWith('/')) {
                            currencyIcon = `<img src="${iconVal}" class="currency-icon-small" alt="${c ? c.name : ''}">`;
                        } else {
                            currencyIcon = `<span class="currency-text">${iconVal}</span>`;
                        }
                    } else if (c && c.name) {
                        currencyIcon = `<span class="currency-text">${c.name}</span>`;
                    }

                    let useDecimals = false;
                    // Heuristic for real money
                    if (s.name.match(/boutique|mog|station|store/i) || (c && c.icon_currency_url && !c.icon_currency_url.startsWith('http'))) {
                        useDecimals = true;
                    }

                    const costStr = ms.cost.toLocaleString('fr-FR', useDecimals ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {});
                    costHtml = `<span class="source-cost badge-cost">${costStr} ${currencyIcon}</span>`;
                }

                const div = document.createElement('div');
                div.className = 'source-item-row';
                div.innerHTML = `
                    <div class="source-left">
                         ${iconUrl.startsWith('http') ? `<img src="${iconUrl}" class="source-icon-large">` : `<i class="${iconUrl} source-icon-fa-large"></i>`}
                        <div class="source-details section-column">
                            <span class="source-name-title">${s.name}</span>
                            ${detailsHtml}
                            ${repHtml}
                        </div>
                    </div>
                    <div class="source-right">
                        ${costHtml}
                    </div>
                `;
                sourcesEl.appendChild(div);
            });
        }
    }
}

// --- MOUNTS LOGIC ---
let mountsCache = null;
let activeMountFilters = {
    collection: null,
    patch: null,
    search: ''
};

async function loadMounts() {
    const list = document.getElementById('mounts-list');
    if (!list) return;

    // Loading State
    list.innerHTML = '<p style="text-align:center; padding:2rem;">Chargement des montures...</p>';

    // 1. Fetch User Mount Collection
    if (currentUser) {
        const { data: userMounts, error: userError } = await supabase
            .from('user_mounts')
            .select('mount_id')
            .eq('user_id', currentUser.id);

        if (!userError && userMounts) {
            userMountCollection = new Set(userMounts.map(row => row.mount_id));
        } else {
            console.warn('Error fetching mount collection:', userError);
        }
    }

    // 2. Fetch Mounts Data
    let mountsData = mountsCache;

    if (!mountsData) {
        // Assume 'mounts' table structure mirrors 'minions'
        const { data, error } = await supabase
            .from('mounts')
            .select(`
                *,
                patches (*),
                reputation_rank,
                mount_sources (
                    details,
                    cost,
                    lodestone_url,
                    location,
                    created_at,
                    sources ( name, icon_source_url ),
                    currencies ( name, icon_currency_url )
                )
            `)
            .order('name', { ascending: true })
            .limit(1000);

        if (error) {
            console.error('Error fetching mounts:', error);
            list.innerHTML = `<p style="color:red; text-align:center;">Erreur de chargement: ${error.message}</p>`;
            return;
        }
        mountsCache = data;
        mountsData = data;
    }

    renderMounts(mountsData);
}

function renderMounts(data) {
    const list = document.getElementById('mounts-list');
    list.innerHTML = '';

    // Apply Filter Logic
    let filteredData = data;
    if (activeMountFilters.collection || activeMountFilters.patch || activeMountFilters.search) {
        filteredData = data.filter(mount => {
            // Patch Filter
            let pVer = '2.0';
            if (mount.patches && mount.patches.version) pVer = String(mount.patches.version);
            else if (mount.patch_id) pVer = String(mount.patch_id);

            if (activeMountFilters.patch) {
                if (!pVer.startsWith(activeMountFilters.patch)) return false;
            }

            // Search Filter
            if (activeMountFilters.search) {
                const name = (mount.name || '').toLowerCase();
                if (!name.includes(activeMountFilters.search)) return false;
            }

            return true;
        });
    }

    if (!filteredData || filteredData.length === 0) {
        list.innerHTML = '<p style="text-align:center; padding: 2rem; color: #888;">Aucune monture ne correspond aux filtres.</p>';
        return;
    }

    setupMountFilterListeners();

    // Intersection Observer
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('scroll-visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    const fragment = document.createDocumentFragment();

    filteredData.forEach((mount, index) => {
        let patchData = null;
        if (mount.patches && !Array.isArray(mount.patches)) { patchData = mount.patches; }
        else if (Array.isArray(mount.patches) && mount.patches.length > 0) { patchData = mount.patches[0]; }

        let patchVersion = '?';
        let patchMajor = '2';
        if (patchData && patchData.version) {
            patchVersion = patchData.version;
            patchMajor = String(patchVersion).charAt(0);
        } else if (mount.patch_id) {
            patchVersion = mount.patch_id;
            patchMajor = String(mount.patch_id).charAt(0);
        }

        const isCollected = userMountCollection.has(mount.id);
        const collectedClass = isCollected ? 'collected' : '';
        const unavailableClass = (mount.available === false) ? 'unavailable' : '';

        const row = document.createElement('div');
        row.className = `minion-row row-${patchMajor} ${collectedClass} ${unavailableClass}`;
        row.style.animationDelay = `${index * 0.05}s`;

        observer.observe(row);

        const iconUrl = mount.icon_mount_url || 'https://xivapi.com/i/000000/000405.png';
        const name = mount.name || 'Inconnu';
        const patchIconUrl = patchData ? patchData.icon_patch_url : null;
        const patchLogoUrl = patchData ? patchData.logo_patch_url : null;

        let badgeHtml = '';
        if (patchIconUrl) {
            badgeHtml = `<img src="${patchIconUrl}" class="patch-badge-img" alt="${patchVersion}" title="Patch ${patchVersion}">`;
        } else {
            badgeHtml = `<span class="patch-badge patch-${patchMajor}">${patchVersion}</span>`;
        }
        let logoHtml = patchLogoUrl ? `<img src="${patchLogoUrl}" class="patch-logo" alt="Logo Patch">` : '';

        // Sources Icons
        let shopIconRendered = false;
        const sourceIconsHtml = (mount.mount_sources || []).map(ms => {
            const s = ms.sources;
            if (!s) return '';
            if (ms.lodestone_url) return '';

            let tooltip = s.name;
            if (ms.details) tooltip += `: ${ms.details}`;

            const iconSrc = s.icon_source_url || '';

            if (s.name && (s.name.toLowerCase().includes('boutique') || s.name.toLowerCase().includes('cdjapan'))) {
                if (mount.shop_url) {
                    shopIconRendered = true;
                    return `<a href="${mount.shop_url}" target="_blank" class="shop-link" onclick="event.stopPropagation()"><i class="fa-solid fa-cart-shopping meta-icon-fa" title="${tooltip}"></i></a>`;
                }
            }

            if (iconSrc && !iconSrc.startsWith('http')) {
                return `<i class="${iconSrc} meta-icon-fa" title="${tooltip}"></i>`;
            }
            return '';
        }).join('');

        // FALLBACK: If we have a Shop URL but no "Shop Source" rendered it
        const standaloneShopHtml = (mount.shop_url && !shopIconRendered)
            ? `<a href="${mount.shop_url}" target="_blank" class="shop-link" onclick="event.stopPropagation()"><i class="fa-solid fa-cart-shopping meta-icon-fa" title="Acheter en ligne"></i></a>`
            : '';

        const acquisitionText = (mount.acquisition && sourceIconsHtml === '') ? `<i class="fa-solid fa-circle-info meta-icon-fa" title="${mount.acquisition}"></i>` : '';

        row.innerHTML = `
            <img src="${iconUrl}" class="minion-icon" alt="${name}">
            <div class="minion-info">
                 <div style="margin-right:auto; display:flex; flex-direction:column; align-items:flex-start;">
                    <span class="minion-name">
                            <span class="minion-name-link" onclick="window.location.hash='mount/${mount.id}'; event.stopPropagation();">${name}</span>
                            <button class="btn-sources-trigger" title="Infos & Sources"><i class="fa-solid fa-magnifying-glass"></i></button>
                            ${mount.hôtel_des_ventes ? '<i class="fa-solid fa-gavel meta-icon-fa" title="Disponible à l\'hôtel des ventes"></i>' : ''}
                            ${mount.malle_surprise ? '<i class="fa-solid fa-box-open meta-icon-fa" title="Disponible dans une malle-surprise"></i>' : ''}
                            ${sourceIconsHtml}
                            ${standaloneShopHtml}
                            ${sourceIconsHtml === '' && standaloneShopHtml === '' ? acquisitionText : ''}
                    </span>
                </div>
            </div>
            
            <div class="minion-center-text" title="${mount.tooltip ? mount.tooltip.replace(/"/g, '&quot;') : ''}">
                 ${mount.tooltip ? `<i class="fa-solid fa-quote-left quote-icon"></i> ${mount.tooltip} <i class="fa-solid fa-quote-right quote-icon"></i>` : ''} 
            </div>
            
            <div class="minion-meta">
                <div class="col-badge">${badgeHtml}</div>
                <div class="col-logo">${logoHtml}</div>
                <div class="btn-collect-container"></div> 
            </div>
        `;

        // --- INTERACTIVITY ---

        // 1. Source Button
        const btnSources = row.querySelector('.btn-sources-trigger');
        if (btnSources) {
            btnSources.addEventListener('click', (e) => {
                e.stopPropagation();
                openMountModal(mount, patchData);
            });
        }

        // 2. Collection Button
        const btnContainer = row.querySelector('.btn-collect-container');
        const btnCollect = document.createElement('button');
        btnCollect.className = isCollected ? 'btn-star-unified collected' : 'btn-star-unified';
        btnCollect.title = "Ajouter à ma collection";
        btnCollect.innerHTML = isCollected
            ? '<i class="fa-solid fa-star"></i>'
            : '<i class="fa-regular fa-star"></i>';

        btnCollect.addEventListener('click', (e) => {
            e.stopPropagation();
            const wasCollected = row.classList.contains('collected');
            if (wasCollected) {
                userMountCollection.delete(mount.id);
                row.classList.remove('collected');
                btnCollect.classList.remove('collected');
                btnCollect.innerHTML = '<i class="fa-regular fa-star"></i>';
                playUncollectSound();
                toggleMountCollection(mount.id, false);
            } else {
                userMountCollection.add(mount.id);
                row.classList.add('collected');
                btnCollect.classList.add('collected');
                btnCollect.innerHTML = '<i class="fa-solid fa-star"></i>';
                playCollectSound();
                toggleMountCollection(mount.id, true);
            }
        });
        btnContainer.appendChild(btnCollect);

        fragment.appendChild(row);
    });

    list.appendChild(fragment);
}

function setupMountFilterListeners() {
    const view = document.getElementById('mounts-view');
    if (!view || view.dataset.init === 'true') return;
    view.dataset.init = 'true';

    const filterBar = view.querySelector('.filter-bar');

    // Collection Filters
    filterBar.querySelectorAll('.btn-star-unified').forEach(btn => {
        btn.addEventListener('click', () => {
            const filterType = btn.dataset.filter;
            if (activeMountFilters.collection === filterType) {
                activeMountFilters.collection = null;
                btn.classList.remove('active');
            } else {
                activeMountFilters.collection = filterType;
                filterBar.querySelectorAll('.btn-star-unified').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
            renderMounts(mountsCache);
        });
    });

    // Patch Filters
    const patchContainer = filterBar.querySelector('.patch-filters');
    if (patchContainer) {
        patchContainer.querySelectorAll('.btn-patch-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                const patchVer = btn.dataset.patch;
                if (activeMountFilters.patch === patchVer) {
                    activeMountFilters.patch = null;
                    btn.classList.remove('active');
                } else {
                    activeMountFilters.patch = patchVer;
                    patchContainer.querySelectorAll('.btn-patch-filter').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                }
                renderMounts(mountsCache);
            });
        });
    }

    // Search
    const searchInput = document.getElementById('mount-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            activeMountFilters.search = e.target.value.trim().toLowerCase();
            renderMounts(mountsCache);
        });
    }

    // Reset
    const resetBtn = document.getElementById('mount-filter-reset');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            activeMountFilters = { collection: null, patch: null, search: '' };
            if (searchInput) searchInput.value = '';
            filterBar.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
            renderMounts(mountsCache);
        });
    }

    // Sync Button
    const syncBtn = document.getElementById('btn-sync-mounts');
    if (syncBtn) {
        syncBtn.addEventListener('click', () => {
            if (!currentUser) {
                alert("Veuillez vous connecter pour synchroniser votre collection.");
                return;
            }
            syncMounts();
        });
    }
}

async function showMountDetails(mountId) {
    switchView('mount-detail-view');

    if (!mountsCache) await loadMounts();

    const mount = mountsCache.find(m => String(m.id) === String(mountId));
    if (!mount) {
        document.getElementById('mount-detail-name').textContent = "Monture introuvable";
        return;
    }

    document.getElementById('mount-detail-name').textContent = mount.name;
    document.getElementById('mount-detail-img').src = mount.image_mount_url || mount.icon_mount_url || '';
    document.getElementById('mount-detail-diary-text').textContent = mount.tooltip || "Pas de description.";

    // Patch Info
    let patchData = null;
    if (mount.patches && !Array.isArray(mount.patches)) patchData = mount.patches;
    else if (Array.isArray(mount.patches) && mount.patches.length > 0) patchData = mount.patches[0];

    const patchBadge = document.getElementById('mount-detail-patch-ver');
    const patchLogo = document.getElementById('mount-detail-patch-logo');

    if (patchData) {
        patchBadge.textContent = `Patch ${patchData.version}`;
        if (patchData.logo_patch_url) {
            patchLogo.src = patchData.logo_patch_url;
            patchLogo.style.display = 'block';
        } else {
            patchLogo.style.display = 'none';
        }
    } else {
        patchBadge.textContent = `Patch ${mount.patch_id || '?'}`;
        patchLogo.style.display = 'none';
    }

    // Sources Render
    const sourcesList = document.getElementById('mount-detail-sources');
    sourcesList.innerHTML = '';

    const sources = (mount.mount_sources || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // Fallback info if no sources
    if (sources.length === 0 && mount.acquisition) {
        sourcesList.innerHTML = `
            <div class="source-item">
                <i class="fa-solid fa-info-circle source-icon-large"></i>
                <div class="source-details">
                    <span class="source-name">Acquisition</span>
                    <span class="source-desc">${mount.acquisition}</span>
                </div>
            </div>`;
    }

    sources.forEach(src => {
        const s = src.sources;
        const c = src.currencies;
        if (!s) return;
        if (src.lodestone_url) return;

        const row = document.createElement('div');
        row.className = 'source-item';

        const iconSrc = s.icon_source_url;
        let iconHtml = '';
        if (iconSrc) {
            if (iconSrc.startsWith('http')) {
                iconHtml = `<img src="${iconSrc}" class="source-icon-img" alt="${s.name}">`;
            } else {
                iconHtml = `<i class="${iconSrc} source-icon-large"></i>`;
            }
        } else {
            iconHtml = `<i class="fa-solid fa-question source-icon-large"></i>`;
        }

        let detailHtml = `<span class="source-name">${s.name}</span>`;
        if (src.location) detailHtml += `<span class="source-desc"><i class="fa-solid fa-location-dot"></i> ${src.location}</span>`;
        if (src.details) detailHtml += `<span class="source-desc">${src.details}</span>`;

        row.innerHTML = `${iconHtml}<div class="source-details">${detailHtml}</div>`;
        sourcesList.appendChild(row);
    });
}

// --- MOUNT HELPERS ---
async function toggleMountCollection(mountId, isCollected) {
    if (!currentUser) return;
    if (isCollected) {
        const { error } = await supabase.from('user_mounts').insert([{ user_id: currentUser.id, mount_id: mountId }]);
        if (error) console.error('Error saving mount:', error);
    } else {
        const { error } = await supabase.from('user_mounts').delete().eq('user_id', currentUser.id).eq('mount_id', mountId);
        if (error) console.error('Error deleting mount:', error);
    }
}

function openMountModal(mount, patchData) {
    const modal = document.getElementById('details-modal');
    if (!modal) return;
    const list = document.getElementById('modal-sources-list');
    list.innerHTML = '';

    const sources = (mount.mount_sources || []).sort((a, b) => {
        return new Date(a.created_at) - new Date(b.created_at);
    });

    // Legacy fallback
    if (sources.length === 0 && mount.acquisition) {
        list.innerHTML = `
            <div class="source-item">
                <i class="fa-solid fa-circle-info source-icon-fa-large"></i>
                <div class="source-details">
                    <span class="source-name">Autre</span>
                    <span class="source-extra">${mount.acquisition}</span>
                </div>
            </div>
        `;
    }

    // Sort sources by ID (Creation Order)
    if (sources) {
        sources.sort((a, b) => (a.id || 0) - (b.id || 0));
    }

    // Toggle 2-column layout only if more than 1 source
    if (sources && sources.length > 1) {
        list.classList.add('has-multiple-sources');
    } else {
        list.classList.remove('has-multiple-sources');
    }

    sources.forEach(ms => {
        const s = ms.sources;
        const c = ms.currencies;

        if (!s) return;

        let iconUrl = s.icon_source_url || '';

        // Dark Mode Logic for CDJapan
        if (s.name === 'CDJapan') {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            if (isDark) {
                iconUrl = 'https://res.cloudinary.com/dd4rdtrig/image/upload/v1766262130/cdjapan_logo_blanc_vrpgph.png';
            }
        }

        // Dark Mode Logic for Square Enix Boutique
        if (s.name === 'Square Enix Boutique') {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            if (isDark) {
                iconUrl = 'https://res.cloudinary.com/dd4rdtrig/image/upload/v1765935529/square_enix_boutique_blanc_mbqtdy.webp';
            }
        }

        const iconUrlFinal = iconUrl;
        const isImg = iconUrlFinal.startsWith('http');

        const iconHtml = isImg
            ? `<img src="${iconUrlFinal}" class="source-icon-large">`
            : `<i class="${iconUrl} source-icon-fa-large"></i>`;

        // Right Column: Cost
        let costHtml = '';
        if (ms.cost && ms.cost > 0) {
            const currencyVal = (c && c.icon_currency_url) ? c.icon_currency_url : '';

            let currencyHtml = '';
            if (currencyVal.startsWith('http')) {
                currencyHtml = `<img src="${currencyVal}" class="currency-icon-img" title="${c ? c.name : ''}">`;
            } else if (currencyVal.startsWith('fa-')) {
                currencyHtml = `<i class="${currencyVal} currency-icon-fa"></i>`;
            } else {
                // Text symbol fallback (e.g. "€")
                currencyHtml = `<span class="currency-symbol">${currencyVal}</span>`;
            }

            costHtml = `
                <div class="source-cost">
                    <span class="cost-value">${currencyVal === '€' || (c && c.name === 'Euro')
                    ? ms.cost.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : ms.cost.toLocaleString()}</span>
                    ${currencyHtml}
                </div>
            `;
        }

        const div = document.createElement('div');
        div.className = 'source-item';

        // Prepare Title and Details
        let sourceTitleHtml = `<span class="source-title">${s.name}</span>`;
        let sourceDetailsHtml = ms.details ? `<span class="source-details">${ms.details}</span>` : '';

        // Apply Lodestone Link
        // Rule: If details exists -> Link details. If details EMPTY -> Link Title.
        if (ms.lodestone_url && ms.lodestone_url.trim() !== '') {
            const hasDetails = ms.details && ms.details.trim() !== '';

            if (hasDetails) {
                sourceDetailsHtml = `<a href="${ms.lodestone_url}" class="eorzeadb_link source-details" target="_blank">${ms.details}</a>`;
            } else {
                sourceTitleHtml = `<a href="${ms.lodestone_url}" class="eorzeadb_link source-title" target="_blank">${s.name}</a>`;
            }
        }

        div.innerHTML = `
            ${iconHtml}
            <div class="source-info">
                ${sourceTitleHtml}
                ${sourceDetailsHtml}
                ${ms.location ? `<span style="font-weight:bold; font-size:0.85rem;">${ms.location}</span>` : ''}
                ${mount.reputation_rank ? `<span style="font-size:0.85rem;">${mount.reputation_rank}</span>` : ''}
            </div>
            ${costHtml}
        `;

        // Link wrapper if Boutique
        if (s.name === 'Boutique' && mount.shop_url) {
            div.style.cursor = 'pointer';
            div.onclick = () => window.open(mount.shop_url, '_blank');
            div.title = "Ouvrir la boutique";
        }

        list.appendChild(div);
    });

    // Show Modal
    modal.classList.remove('hidden');
}


