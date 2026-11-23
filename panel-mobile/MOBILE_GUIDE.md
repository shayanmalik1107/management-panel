# LAMBA Mobile App (Android & Responsive Web)

This is the standalone mobile application wrapped with **Capacitor** and **Vite React**.

## 📱 Features
- **Offline-First Login Sessions**: Log in once. Session tokens, permissions, user profile, and company info are persisted locally in `lamba_auth_session`. Cold-starting the app while offline opens directly to the dashboard without redirecting or kicking the user out.
- **IndexedDB Offline Database & Queue**: Orders, customers, products, and payments are cached locally in IndexedDB (`lamba_offline_store`).
- **Auto-Sync Engine**: Any orders created offline receive an offline badge (`⏳ Offline`) and auto-commit to Firebase RTDB with transactional stock deduction the moment internet connectivity returns.
- **Mobile Responsive Design**: Includes notch/safe-area insets (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`), touch action tuning, and a native mobile bottom navigation bar (`Home`, `Orders`, `+ New Order`, `Customers`, `Menu`).
- **Floating AI Assistant**: Positioned above the mobile bottom bar for one-tap voice & visual guidance.

---

## 📦 Android APK
The compiled Android APK is located at:
- **Root Release Path**: `panel-mobile/lamba-management.apk`
- **Gradle Build Output**: `panel-mobile/android/app/build/outputs/apk/debug/app-debug.apk`

To install on an Android phone via USB (`adb`):
```bash
adb install -r lamba-management.apk
```
Or simply transfer `lamba-management.apk` to your phone via WhatsApp, Google Drive, or USB cable and tap to install.

---

## 🛠️ Mobile CLI Scripts

From inside `/Users/apple/Documents/GitHub/panel-mobile`:

- **Run Dev Server**:
  ```bash
  npm run dev
  ```
- **Build Web Assets & Sync to Android**:
  ```bash
  npm run mobile:build
  ```
- **Recompile Android APK**:
  ```bash
  npm run mobile:apk
  ```
- **Open in Android Studio**:
  ```bash
  npm run mobile:open
  ```

