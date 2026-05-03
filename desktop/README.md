# Tauri Desktop — Salon de Coiffure

Application de bureau (Windows, macOS, Linux) construite avec [Tauri 2](https://tauri.app/).

## Prérequis

```bash
# Rust (via rustup)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Node.js 20+ (déjà installé si vous avez le frontend)
```

## Démarrage développement

```bash
# Depuis la racine du projet
npm install --prefix desktop
npx tauri dev
```

## Build de production

```bash
npx tauri build
# Binaire dans: desktop/target/release/
# Installeur dans: desktop/target/release/bundle/
```

## Architecture

```
desktop/
  src/           # Code Rust (Tauri backend)
    main.rs      # Point d'entrée
    lib.rs       # Application Tauri
  build.rs       # Script de build Tauri
  Cargo.toml     # Dépendances Rust
  tauri.conf.json # Configuration Tauri
```

## Notifications desktop

Les notifications push passent par Tauri via le plugin `tauri-plugin-notification`.
Le frontend détecte l'environnement Tauri (`window.__TAURI__`) et utilise l'API native
plutôt que le Service Worker pour les notifications.

```typescript
// Détection côté frontend
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

if (isTauri) {
  const { sendNotification } = await import('@tauri-apps/plugin-notification');
  await sendNotification({ title, body });
} else {
  // Web / PWA Service Worker
}
```

## Variables d'environnement

Le backend URL est injecté via la config Tauri (`build.devUrl` / `build.frontendDist`).
En production, pointer vers `https://api.salon-beaute.fr`.
