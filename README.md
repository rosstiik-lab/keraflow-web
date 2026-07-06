# KERAFLOW

Застосунок для плиточників — облік об'єктів, робіт, матеріалів, оплат, замовників і працівників.

Один файл `www/index.html`: чистий HTML/CSS/JS без збірки, дані зберігаються в `localStorage` браузера (ключ `keraflow-data`).

## Веб-версія

Файл `www/index.html` можна відкрити напряму в браузері або розгорнути на будь-якому статичному хостингу (Vercel, Netlify, GitHub Pages). Поточний деплой на Vercel налаштований читати вміст саме з папки `www/` (див. `vercel.json`, `outputDirectory: "www"`).

## Мобільний застосунок (Android) через Capacitor

Потрібен встановлений Android Studio.

### 1. Встановити залежності

```bash
npm install
```

### 2. Додати нативний проєкт (один раз)

```bash
npx cap add android
```

Це створить папку `android/` з нативним Android Studio проєктом — вона комітиться в репозиторій разом з рештою коду.

### 3. Синхронізувати веб-контент із нативним проєктом

Виконуй після кожної зміни `www/index.html`:

```bash
npx cap sync
```

(або `npm run sync`)

### 4. Відкрити нативний проєкт і запустити

```bash
npx cap open android
```

Це відкриє проєкт у Android Studio, звідки можна запустити застосунок на емуляторі чи реальному пристрої, а також зібрати build для Google Play.

### Налаштування застосунку

Основні параметри — у `capacitor.config.json`:

- `appId` — `com.rosstiik.keraflow`
- `appName` — `KERAFLOW`
- `webDir` — `www`

Після зміни `capacitor.config.json` повторно виконай `npx cap sync`.
