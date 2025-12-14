const SUPABASE_URL = 'https://hbktwpbyxpobtsoyqoss.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhia3R3cGJ5eHBvYnRzb3lxb3NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NTI2MTYsImV4cCI6MjA4MTIyODYxNn0.TK7xhWRHQ2e_ztpgVXkhvQxR0AuvATymd9RvlgVAFAE';

// Initialisation du client Supabase
// Note: Ceci ne fonctionnera que si vous remplacez les valeurs ci-dessus.
let supabase;

try {
    if (SUPABASE_URL === 'VOTRE_SUPABASE_URL' || !SUPABASE_URL) {
        console.warn('Supabase URL non configurée.');
        document.getElementById('auth-status').innerHTML = '<span style="color: #fbbf24; font-size: 0.9rem;">⚠️ Supabase non configuré</span>';
    } else {
        supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client initialisé');
        document.getElementById('auth-status').innerHTML = '<span style="color: #4ade80; font-size: 0.9rem;">● Supabase connecté</span>';

        // Exemple: Écouter les changements d'état d'authentification
        supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth event:', event, session);
        });
    }
} catch (error) {
    console.error('Erreur lors de l\'initialisation de Supabase:', error);
}

// Exemple de fonction de connexion (à connecter au bouton)
const loginBtn = document.getElementById('login-btn');
if (loginBtn) {
    loginBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!supabase) {
            alert('Veuillez configurer Supabase URL et Key dans app.js');
            return;
        }
        // Logique de connexion ici
        alert('Fonctionnalité de connexion prête à être implémentée !');
    });
}
