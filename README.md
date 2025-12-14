# Into The Mist

Site personnel connecté à Supabase.

## 🚀 Démarrage Rapide

Ce projet est une structure de base HTML/CSS/JS prête pour Supabase.

### 1. Configuration Locale

1. Installez les dépendances :
   ```bash
   npm install
   ```
2. Créez un fichier `.env` à la racine (copiez le `.gitignore` pour voir ce qui est exclu, non je plaisante, voir ci-dessous) :
   ```env
   VITE_SUPABASE_URL=Votre_URL_Supabase
   VITE_SUPABASE_ANON_KEY=Votre_Anon_Key_Supabase
   ```
3. Lancez le serveur de développement :
   ```bash
   npm run dev
   ```

### 2. Connecter le Repository à Supabase

Pour déployer :

1. Poussez ce code sécurisé (les clés ne seront PAS dans le repo, grâce au `.gitignore`).
2. Sur **Vercel** ou **Netlify**, importez le projet.
3. **IMPORTANT** : Ajoutez manuellement vos variables d'environnement (`VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`) dans les réglages de votre hébergeur.

## 🛠 Structure

- `index.html` : Page principale.
- `style.css` : Styles "Premium".
- `app.js` : Logique de l'application et client Supabase.
