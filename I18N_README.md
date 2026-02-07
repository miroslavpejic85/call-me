# i18n Support - Quick Start

The Call-me application now supports multiple languages! 🌍

## Supported Languages

- 🇬🇧 English (en)
- 🇪🇸 Spanish (es)
- 🇫🇷 French (fr)
- 🇮🇹 Italian (it)
- 🇩🇪 German (de)

## Features

- ✅ Automatic language detection from browser
- ✅ Language persistence in localStorage
- ✅ Real-time language switching
- ✅ JSON-based translations
- ✅ RESTful translations API

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
GET /translations/:locale
# Example: GET /translations/es
```

## Files Structure

```
locales/
├── en.json  # English translations
├── es.json  # Spanish translations
├── fr.json  # French translations
├── it.json  # Italian translations
└── de.json  # German translations

public/
└── i18n.js  # Client-side i18n library

doc/
└── i18n.md  # Complete documentation
```

## Quick Test

```bash
# Test English translations
curl http://localhost:8000/translations/en

# Test Spanish translations
curl http://localhost:8000/translations/es
```

## Documentation

For complete documentation, see [doc/i18n.md](doc/i18n.md)

## Based On

Implementation follows the [Crowdin Node.js i18n guide](https://crowdin.com/blog/nodejs-i18n-and-localization)
