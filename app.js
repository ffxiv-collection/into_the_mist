import { createClient } from '@supabase/supabase-js'

// Utilisation des variables d'environnement VITE_
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase;

try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.warn('Supabase URL ou Key manquante dans le fichier .env.');
        const statusEl = document.getElementById('auth-status');
        if (statusEl) statusEl.innerHTML = '<span style="color: #fbbf24; font-size: 0.9rem;">⚠️ Config manquante</span>';
    } else {
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client initialisé via Vite');
        fetchSprites();
    }
} catch (error) {
    console.error('Erreur lors de l\'initialisation de Supabase:', error);
}

// Helper to check collision with other sprites
function isTooClose(x, y, existingPositions, minDistance = 8) {
    for (const pos of existingPositions) {
        // Euclidean distance (approx in % is fine for this visual)
        const dx = x - pos.x;
        const dy = (y - pos.y) * 0.56; // Aspect ratio correction (16:9 approx) 
        // We act as if screen is wider, so Y% is "worth" more pixels than X% essentially.
        // Actually let's keep it simple: just raw distance.
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDistance) return true;
    }
    return false;
}

// Logic to scatter sprites naturally avoiding center and top
async function fetchSprites() {
    const container = document.getElementById('supabase-data');
    if (!container) return;

    const { data, error } = await supabase.from('sprites').select('*');

    if (error || !data) {
        console.error('Erreur fetch sprites:', error);
        return;
    }

    container.innerHTML = '';
    const placedPositions = [];

    data.forEach((spriteData, index) => {
        const sprite = document.createElement('div');
        sprite.className = 'floating-sprite';

        const url = spriteData.icon_sprite_url;
        if (!url) return;

        sprite.style.backgroundImage = `url('${url}')`;

        // Rejection Sampling: Try N times to find a good spot
        let validX = 0, validY = 0;
        let found = false;

        // Try 50 times to place this sprite
        for (let attempt = 0; attempt < 50; attempt++) {
            // Random candidates
            // X: 2% to 92% (keep away from extreme edges)
            const cx = Math.random() * 90 + 2;
            // Y: 35% to 90% (Below Banner)
            const cy = Math.random() * 55 + 35;

            // 1. Avoid Center Box (Login form)
            // Left boundary: 30%, Right boundary: 70%
            // But strict box is boring. Let's make it a bit fuzzy or strict.
            const inCenterZone = (cx > 28 && cx < 72);

            if (inCenterZone) continue;

            // 2. Avoid overlap with existing sprites
            if (isTooClose(cx, cy, placedPositions)) continue;

            // Valid!
            validX = cx;
            validY = cy;
            found = true;
            break;
        }

        if (found) {
            sprite.style.left = `${validX}%`;
            sprite.style.top = `${validY}%`;

            // Random animation delay
            sprite.style.animationDelay = `-${Math.random() * 5}s`;

            // Random floats to break "sameness"
            // Some float faster?
            // sprite.style.animationDuration = `${5 + Math.random() * 4}s`;

            container.appendChild(sprite);
            placedPositions.push({ x: validX, y: validY });
        }
    });
}
