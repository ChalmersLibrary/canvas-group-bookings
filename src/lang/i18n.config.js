const { I18n } = require('i18n');
const path = require('path');

const i18n = new I18n({
  locales: ['en-GB', 'en-US', 'sv-SE'],
  defaultLocale: 'en-GB',
  /* Resolved from this file, so the locales are found wherever the process was started from. */
  directory: path.join(__dirname, 'locales'),
  /* A lookup for a key that is not in the file otherwise appends it, rewriting the locale being
     served. The translations are edited deliberately, so a missing key is a thing to notice
     rather than to create. */
  updateFiles: false
});

module.exports = i18n;