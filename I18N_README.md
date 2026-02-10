# i18n Support

This repository supports multiple languages via JSON translation files in `app/locales/`.

## Supported Languages

- 🇬🇧 English (en)
- 🇪🇸 Spanish (es)
- 🇫🇷 French (fr)
- 🇮🇹 Italian (it)
- 🇩🇪 German (de)
- 🇧🇷 Portuguese (pt)
- 🇷🇺 Russian (ru)
- 🇸🇦 Arabic (ar)
- 🇮🇳 Hindi (hi)
- 🇨🇳 Chinese (zh)
- 🇯🇵 Japanese (ja)

## Features

- ✅ Automatic language detection from browser
- ✅ Language persistence in localStorage
- ✅ Real-time language switching
- ✅ JSON-based translations
- ✅ RESTful translations API
- ✅ Dynamic locale discovery (no hardcoded locale list)

## How It Works

### Translation source of truth

- Translations live in `app/locales/<locale>.json`.
- The server does not translate strings; it only serves these JSON files to the browser.
- Locales are discovered dynamically by scanning `app/locales/*.json` (no config change required).

### API

- `GET /locales` returns available locale codes derived from `app/locales/*.json`.
- `GET /translations/:locale` returns the full JSON translations for that locale.

### Client behavior

- Chooses a locale in this order: `localStorage.locale` (if supported) → browser language → default `en`.
- Uses dot-notation keys (example: `signIn.button`).
- Supports placeholder replacement using `__name__` tokens.

## Usage

### For Users

1. Open the application
2. Click the sidebar button (users icon)
3. Go to "Settings" tab
4. Select your preferred language from the dropdown (with flag emojis)

### For Developers

**Add translation to HTML:**

```html
<button data-i18n="signIn.button">Sign In</button>
<input data-i18n-placeholder="signIn.username" placeholder="Enter username" />
```

**Use in JavaScript:**

```javascript
const text = t('signIn.button'); // Returns: "Sign In"
const message = t('room.userJoined', { username: 'John' }); // Returns: "John joined the call"
```

**Placeholder format:**

In your JSON:

```json
{
    "room": {
        "userJoined": "__username__ joined the call"
    }
}
```

In JS:

```javascript
t('room.userJoined', { username: 'John' });
```

**API Endpoint:**

```bash
GET /locales
# Example: GET /locales

GET /translations/:locale
# Example: GET /translations/es
```

## Files Structure

```
app/locales/
├── en.json  # English translations
├── es.json  # Spanish translations
├── fr.json  # French translations
├── it.json  # Italian translations
└── ...      # Other locales (pt, ru, ar, hi, zh, ja)

public/
└── i18n.js  # Client-side i18n library
```

## Quick Test

```bash
# List supported locales (derived from app/locales/*.json)
curl http://localhost:8000/locales

# Test English translations
curl http://localhost:8000/translations/en

# Test Spanish translations
curl http://localhost:8000/translations/es
```

## Adding a New Language

1. Create `app/locales/<locale>.json` (example: `app/locales/nl.json`).
2. Copy the structure of `app/locales/en.json` and translate only the values.
3. No restart is required: the client will see the new locale via `GET /locales`.

Optional:

- If you want a friendly label (flag + name) in the Settings dropdown, add your locale to the `getLocaleLabel()` mapping in `public/i18n.js`. Otherwise the dropdown shows the raw locale code.

## Notes

- This project uses client-side i18n (see `public/i18n.js`). The server remains language-agnostic.
- Any server-generated messages (API errors, WebSocket `error` payloads) are currently plain strings and are not translated.

## Adding / Changing Translation Keys

- Keep keys consistent across all locale files.
- Keys are nested objects; the client uses dot-notation to access them.
- If a key is missing, the client logs a warning and shows the key string.
