import { createClient } from '@supabase/supabase-js'

// Utilisation des variables d'environnement VITE_
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Initialisation du client Supabase
let supabase;

try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.warn('Supabase URL ou Key manquante dans le fichier .env.');
        const statusEl = document.getElementById('auth-status');
        if (statusEl) statusEl.innerHTML = '<span style="color: #fbbf24; font-size: 0.9rem;">⚠️ Config manquante</span>';
    } else {
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client initialisé via Vite');

        // Fetch and display sprites
        fetchSprites();
    }
} catch (error) {
    console.error('Erreur lors de l\'initialisation de Supabase:', error);
}

// Logic to scatter sprites without overlapping the center area too much
// And keeping them BELOW the banner (Top > 35%)
async function fetchSprites() {
    const container = document.getElementById('supabase-data');
    if (!container) return;

    // Use the new 'sprites' table
    const { data, error } = await supabase
        .from('sprites')
        .select('*');

    if (error || !data) {
        console.error('Erreur fetch sprites:', error);
        return;
    }

    // Clear container
    container.innerHTML = '';

    // --- Slot System to avoid overlapping ---
    // We define a "Grid" of possible positions.
    // Screen is 100% x 100%.
    // Sprite is roughly 5-8%. Let's say a slot is 10% x 10%.
    // We want to avoid:
    // 1. Top Banner: Y < 35%
    // 2. Center Box: X between 30% and 70% (approx)

    const slots = [];
    const step = 12; // Grid cell size in %
    const startY = 35; // Below banner

    for (let y = startY; y < 90; y += step) {
        for (let x = 5; x < 90; x += step) {
            // Check if inside the Center "Danger Zone" (Login Box)
            // Left: x < 30 is OK
            // Right: x > 70 is OK
            if (x > 30 && x < 70) {
                continue; // Skip this slot
            }
            slots.push({ x, y });
        }
    }

    // Shuffle slots (Fisher-Yates)
    for (let i = slots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [slots[i], slots[j]] = [slots[j], slots[i]];
    }

    // Create sprites
    data.forEach((spriteData, index) => {
        // If we run out of slots, stop spawning (or overlap, but let's just stop)
        if (index >= slots.length) return;

        const sprite = document.createElement('div');
        sprite.className = 'floating-sprite';

        // Use the user-defined column name
        const url = spriteData.icon_sprite_url;

        if (!url) return;

        sprite.style.backgroundImage = `url('${url}')`;

        // Pick a unique slot
        const slot = slots[index];

        // Add a tiny random jitter so they aren't perfectly aligned like a chessboard
        const jitterX = (Math.random() - 0.5) * 4;
        const jitterY = (Math.random() - 0.5) * 4;

        sprite.style.left = `${slot.x + jitterX}%`;
        sprite.style.top = `${slot.y + jitterY}%`;

        // Random animation delay
        sprite.style.animationDelay = `-${Math.random() * 5}s`;

        container.appendChild(sprite);
    });
}
