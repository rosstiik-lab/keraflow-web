# KERAFLOW

Застосунок для плиточників — облік об'єктів, робіт, матеріалів, оплат, замовників і працівників.

Один файл `www/index.html`: чистий HTML/CSS/JS без збірки, дані зберігаються в `localStorage` браузера (ключ `keraflow-data`).

## Веб-версія

Файл `www/index.html` можна відкрити напряму в браузері або розгорнути на будь-якому статичному хостингу (Vercel, Netlify, GitHub Pages). Поточний деплой на Vercel налаштований читати вміст саме з папки `www/` (див. `vercel.json`, `outputDirectory: "www"`).

## Мобільні застосунки (iOS / Android) через Capacitor

Потрібен Mac з встановленим Xcode (для iOS) і/або Android Studio (для Android).

### 1. Встановити залежності

```bash
npm install
```

### 2. Додати нативні проєкти (один раз)

```bash
npx cap add ios
npx cap add android
```

Це створить папки `ios/` і `android/` з нативними Xcode/Android Studio проєктами — вони комітяться в репозиторій разом з рештою коду.

### 3. Синхронізувати веб-контент із нативними проєктами

Виконуй після кожної зміни `www/index.html`:

```bash
npx cap sync
```

(або `npm run sync`)

### 4. Відкрити нативний проєкт і запустити

```bash
npx cap open ios
```

```bash
npx cap open android
```

Це відкриє проєкт у Xcode / Android Studio, звідки можна запустити застосунок на симуляторі/емуляторі чи реальному пристрої, а також зібрати build для App Store / Google Play.

### Налаштування застосунку

Основні параметри — у `capacitor.config.json`:

- `appId` — `com.keraflow.app`
- `appName` — `KERAFLOW`
- `webDir` — `www`

Після зміни `capacitor.config.json` повторно виконай `npx cap sync`.
