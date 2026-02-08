# i18n Support - Quick Start

The Call-me application now supports multiple languages! 🌍

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

doc/
└── i18n.md  # Complete documentation
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

## Documentation

For complete documentation, see [doc/i18n.md](doc/i18n.md)

## Based On

Implementation follows the [Crowdin Node.js i18n guide](https://crowdin.com/blog/nodejs-i18n-and-localization)
