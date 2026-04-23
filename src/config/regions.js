const REGIONS = {
  UZ: {
    code: 'UZ',
    name: 'Узбекистан',
    flag: '🇺🇿',
    phonePrefix: '+998',
    phoneFormat: '+998 (XX) XXX-XX-XX',
    currency: 'UZS',
    currencySymbol: 'сум',
    locale: 'ru-UZ',
    timezone: 'Asia/Tashkent',
  },
  RU: {
    code: 'RU',
    name: 'Россия',
    flag: '🇷🇺',
    phonePrefix: '+7',
    phoneFormat: '+7 (XXX) XXX-XX-XX',
    currency: 'RUB',
    currencySymbol: '₽',
    locale: 'ru-RU',
    timezone: 'Europe/Moscow',
  },
  KZ: {
    code: 'KZ',
    name: 'Казахстан',
    flag: '🇰🇿',
    phonePrefix: '+7',
    phoneFormat: '+7 (XXX) XXX-XX-XX',
    currency: 'KZT',
    currencySymbol: '₸',
    locale: 'ru-KZ',
    timezone: 'Asia/Almaty',
  },
  KG: {
    code: 'KG',
    name: 'Кыргызстан',
    flag: '🇰🇬',
    phonePrefix: '+996',
    phoneFormat: '+996 (XXX) XXX-XXX',
    currency: 'KGS',
    currencySymbol: 'сом',
    locale: 'ru-KG',
    timezone: 'Asia/Bishkek',
  },
  TJ: {
    code: 'TJ',
    name: 'Таджикистан',
    flag: '🇹🇯',
    phonePrefix: '+992',
    phoneFormat: '+992 (XX) XXX-XX-XX',
    currency: 'TJS',
    currencySymbol: 'сомони',
    locale: 'ru-TJ',
    timezone: 'Asia/Dushanbe',
  },
  US: {
    code: 'US',
    name: 'США',
    flag: '🇺🇸',
    phonePrefix: '+1',
    phoneFormat: '+1 (XXX) XXX-XXXX',
    currency: 'USD',
    currencySymbol: '$',
    locale: 'en-US',
    timezone: 'America/New_York',
  },
};

function getRegion(code) {
  return REGIONS[code] || REGIONS.UZ;
}

module.exports = { REGIONS, getRegion };
