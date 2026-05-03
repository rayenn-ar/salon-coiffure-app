# Mobile — Salon de Coiffure (Capacitor)

Application iOS/Android construite avec [Capacitor 6](https://capacitorjs.com/) à partir du frontend Next.js.

## Prérequis

```bash
# Android
# Installer Android Studio : https://developer.android.com/studio
# SDK Android API 24+ (Android 7.0)

# iOS (macOS uniquement)
# Installer Xcode via l'App Store
# sudo gem install cocoapods
```

## Installation

```bash
cd mobile
npm install

# Build le frontend d'abord
npm run build --prefix ../frontend

# Ajouter les plateformes (1 seule fois)
npx cap add android
npx cap add ios

# Synchroniser après chaque modification frontend
npx cap sync
```

## Démarrage

```bash
# Android
npm run open:android   # ouvre Android Studio
npx cap run android    # lance directement sur émulateur/device

# iOS (macOS uniquement)
npm run open:ios       # ouvre Xcode
npx cap run ios        # lance directement
```

## Notifications Push

Les notifications push Capacitor utilisent Firebase (Android) et APNs (iOS).

### Android
1. Créer un projet Firebase : https://console.firebase.google.com/
2. Télécharger `google-services.json` → placer dans `android/app/`
3. Ajouter dans `android/app/build.gradle` :
   ```groovy
   apply plugin: 'com.google.gms.google-services'
   ```

### iOS
1. Dans Xcode : Signing & Capabilities → ajouter "Push Notifications" + "Background Modes"
2. Activer "Remote notifications" dans Background Modes
3. Générer un certificat APNs dans Apple Developer Console
4. Uploader dans Firebase Console sous Project Settings → Cloud Messaging

## Intégration avec le backend

Le token FCM/APNs est envoyé à `/api/push/register` après l'obtention via Capacitor :

```typescript
import { PushNotifications } from '@capacitor/push-notifications';

const registerPush = async () => {
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return;

  await PushNotifications.register();

  PushNotifications.addListener('registration', async ({ value: token }) => {
    await fetch('/api/push/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, platform: 'android' }),  // ou 'ios'
    });
  });
};
```

## Variables d'environnement

Pour pointer vers le bon serveur backend, modifier `capacitor.config.json` :
```json
{
  "server": {
    "url": "https://api.salon-beaute.fr",
    "cleartext": false
  }
}
```
