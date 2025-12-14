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

        // Fetch and display mascots
        fetchMascots();
    }
} catch (error) {
    console.error('Erreur lors de l\'initialisation de Supabase:', error);
}

// Logic to scatter sprites without overlapping the center area too much
async function fetchMascots() {
    const container = document.getElementById('supabase-data');
    if (!container) return;

    // container.innerHTML = '<p>Chargement...</p>'; // Remove loader for "decoration" feel

    const { data, error } = await supabase
        .from('mascots')
        .select('*');

    if (error || !data) {
        console.error('Erreur fetch:', error);
        return;
    }

    // Clear container
    container.innerHTML = '';

    // Create sprites
    data.forEach((mascot, index) => {
        const sprite = document.createElement('div');
        sprite.className = 'floating-sprite';
        sprite.style.backgroundImage = `url('${mascot.image_url}')`;

        // Random positioning logic
        // We want them vaguely around the center, but not ON the center box.
        // Simple approach: Random X/Y, but if it falls in the "danger zone" (center 40%), push it out.

        let x, y;
        const safeZoneMin = 35; // 35%
        const safeZoneMax = 65; // 65%

        // Very basic scatter: 
        // We loop until we find a pos outside the center box, or just pick a quadrant.
        // Let's pick a quadrant based on index to distribute evenly.
        const quadrant = index % 4; // 0: TopLeft, 1: TopRight, 2: BottomLeft, 3: BottomRight

        if (quadrant === 0) { // Top Left
            x = Math.random() * 30 + 10; // 10-40%
            y = Math.random() * 30 + 10;
        } else if (quadrant === 1) { // Top Right
            x = Math.random() * 30 + 60; // 60-90%
            y = Math.random() * 30 + 10;
        } else if (quadrant === 2) { // Bottom Left
            x = Math.random() * 30 + 10;
            y = Math.random() * 30 + 60;
        } else { // Bottom Right
            x = Math.random() * 30 + 60;
            y = Math.random() * 30 + 60;
        }

        sprite.style.left = `${x}%`;
        sprite.style.top = `${y}%`;

        // Random animation delay
        sprite.style.animationDelay = `-${Math.random() * 5}s`;

        container.appendChild(sprite);
    });
}
