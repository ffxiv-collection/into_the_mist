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

    // Create sprites
    data.forEach((spriteData, index) => {
        const sprite = document.createElement('div');
        sprite.className = 'floating-sprite';

        // Use the user-defined column name
        const url = spriteData.icon_sprite_url;

        if (!url) return;

        sprite.style.backgroundImage = `url('${url}')`;

        // Random positioning logic
        // We want to avoid the TOP 35% (Banner) and the CENTER (Login Form)

        let x, y;
        const quadrant = index % 4;

        // Adjusting quadrants to be "Below Banner" (Y > 35%)
        // Top Left (but below banner)
        if (quadrant === 0) {
            x = Math.random() * 30 + 5;   // Left: 5% - 35%
            y = Math.random() * 20 + 35;  // Top-ish: 35% - 55%
        }
        // Top Right (but below banner)
        else if (quadrant === 1) {
            x = Math.random() * 30 + 65;  // Right: 65% - 95%
            y = Math.random() * 20 + 35;  // Top-ish: 35% - 55%
        }
        // Bottom Left
        else if (quadrant === 2) {
            x = Math.random() * 30 + 5;   // Left
            y = Math.random() * 20 + 65;  // Bottom: 65% - 85%
        }
        // Bottom Right
        else {
            x = Math.random() * 30 + 65;  // Right
            y = Math.random() * 20 + 65;  // Bottom
        }

        sprite.style.left = `${x}%`;
        sprite.style.top = `${y}%`;

        // Random animation delay
        sprite.style.animationDelay = `-${Math.random() * 5}s`;

        container.appendChild(sprite);
    });
}
