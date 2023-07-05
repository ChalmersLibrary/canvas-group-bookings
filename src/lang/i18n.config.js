const { I18n } = require('i18n');
const path = require('path');

const i18n = new I18n({
  locales: ['en', 'sv'],
  defaultLocale: 'en',
  directory: path.join('./src/lang', 'locales')
});

module.exports = i18n;