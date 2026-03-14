import { defineConfig } from 'vite'

export default defineConfig({
    base: '/',
    envPrefix: 'VITE_',
    build: {
        rollupOptions: {
            input: {
                main: 'index.html',
                accueil: 'accueil.html',
                minions: 'minions.html',
                mounts: 'mounts.html',
                bardings: 'bardings.html',
                orchestrion: 'orchestrion.html',
                detail: 'detail.html'
            }
        }
    }
})
