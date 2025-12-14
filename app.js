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

    if (session) {
        // Logged In
        loginView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
    } else {
        // Logged Out
        loginView.classList.remove('hidden');
        dashboardView.classList.add('hidden');
        // Refresh sprites scatter if needed
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
                // Success handled by onAuthStateChange
                console.log('Login success', data);
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
    // Only run if login view is visible? Or always?
    // Let's check container existence.
    const container = document.getElementById('supabase-data');
    if (!container) return;

    // Avoid double fetch if already populated
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
