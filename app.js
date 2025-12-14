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

        const statusEl = document.getElementById('auth-status');
        if (statusEl) statusEl.innerHTML = '<span style="color: #4ade80; font-size: 0.9rem;">● Supabase connecté (Vite)</span>';

        // Exemple: Écouter les changements d'état d'authentification
        supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth event:', event, session);
        });

        // Fetch and display mascots
        fetchMascots();
    }
} catch (error) {
    console.error('Erreur lors de l\'initialisation de Supabase:', error);
}

async function fetchMascots() {
    const container = document.getElementById('supabase-data');
    if (!container) return;

    container.innerHTML = '<p>Chargement des mascottes...</p>';

    const { data, error } = await supabase
        .from('mascots')
        .select('*');

    if (error) {
        console.error('Erreur fetch:', error);
        container.innerHTML = `<p style="color: red">Erreur: ${error.message}</p>`;
        return;
    }

    if (!data || data.length === 0) {
        container.innerHTML = '<p>Aucune mascotte trouvée.</p>';
        return;
    }

    // Render cards
    container.innerHTML = data.map(mascot => `
        <div class="card mascot-card">
            <div class="card-image" style="background-image: url('${mascot.image_url || 'https://via.placeholder.com/150'}')"></div>
            <h3>${mascot.name}</h3>
            <p>${mascot.description}</p>
        </div>
    `).join('');
}

// Exemple de fonction de connexion (à connecter au bouton)
const loginBtn = document.getElementById('login-btn');
if (loginBtn) {
    loginBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!supabase) {
            alert('Erreur configuration Supabase');
            return;
        }
        alert('Fonctionnalité de connexion prête à être implémentée !');
    });
}
