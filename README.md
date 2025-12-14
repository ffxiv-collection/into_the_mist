# Into The Mist

Site personnel connecté à Supabase.

## 🚀 Démarrage Rapide

Ce projet est une structure de base HTML/CSS/JS prête pour Supabase.

### 1. Configuration Locale

1. Ouvrez `app.js`.
2. Remplacez `VOTRE_SUPABASE_URL` et `VOTRE_SUPABASE_ANON_KEY` par les valeurs de votre projet Supabase.

### 2. Connecter le Repository à Supabase

Pour déployer ce site et le lier à votre projet Supabase :

1. Poussez ce code sur votre repository GitHub `ffxiv-collection/into_the_mist`.
   ```bash
   git add .
   git commit -m "Initial commit with Supabase setup"
   git push origin main
   ```

2. Allez sur le [Dashboard Supabase](https://supabase.com/dashboard).
3. Sélectionnez votre projet (ou créez-en un nouveau).
4. Allez dans les paramètres ou cherchez l'intégration "GitHub".
5. Si vous utilisez **Supabase Edge Functions** ou si vous voulez héberger le site, vous pouvez regarder du côté de Vercel ou Netlify qui s'intègrent très bien avec Supabase et GitHub.
   - *Note : Supabase ne fait pas d'hébergement de site statique directement (sauf via le Storage, mais c'est moins courant).*
   - **Recommandation** : Connectez ce repo à **Vercel** ou **Netlify**.
     - Sur Vercel : "Add New Project" -> "Import Git Repository" -> Sélectionnez `into_the_mist`.
     - Ajoutez les variables d'environnement `SUPABASE_URL` et `SUPABASE_ANON_KEY` dans les paramètres de Vercel.

## 🛠 Structure

- `index.html` : Page principale.
- `style.css` : Styles "Premium".
- `app.js` : Logique de l'application et client Supabase.
