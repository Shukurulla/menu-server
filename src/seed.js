require('dotenv').config();
const connectDB = require('./config/db');
const SystemAdmin = require('./models/SystemAdmin');
const Restaurant = require('./models/Restaurant');
const Table = require('./models/Table');
const Category = require('./models/Category');
const Food = require('./models/Food');
const { encrypt } = require('./utils/aes');
const { getRegion } = require('./config/regions');

async function run() {
  await connectDB();

  const superEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@menu.app';
  const superPassword = process.env.SUPER_ADMIN_PASSWORD || 'admin123';

  let admin = await SystemAdmin.findOne({ email: superEmail });
  if (!admin) {
    admin = await SystemAdmin.create({ email: superEmail, password: encrypt(superPassword) });
    console.log('✓ Super admin создан:', superEmail, '/', superPassword);
  } else {
    console.log('✓ Super admin уже есть:', superEmail);
  }

  const uzRegion = getRegion('UZ');

  let rest = await Restaurant.findOne({ slug: 'navvot' });
  if (!rest) {
    rest = await Restaurant.create({
      brandName: 'Navvot',
      slug: 'navvot',
      email: 'admin@navvot.uz',
      password: encrypt('navvot123'),
      region: uzRegion.code,
      phonePrefix: uzRegion.phonePrefix,
      phoneFormat: uzRegion.phoneFormat,
      currency: uzRegion.currency,
      currencySymbol: uzRegion.currencySymbol,
      locale: uzRegion.locale,
      timezone: uzRegion.timezone,
      phone: '90 123 45 67',
      address: 'г. Ташкент, Амир Темур 12',
      description: 'Национальная и европейская кухня.',
      adminName: 'Алишер Каримов',
      status: 'active',
    });
    console.log('✓ Ресторан Navvot создан: admin@navvot.uz / navvot123');

    const cats = await Category.insertMany([
      { restaurant: rest._id, name: 'Основные блюда', emoji: '🍲', order: 1 },
      { restaurant: rest._id, name: 'Салаты', emoji: '🥗', order: 2 },
      { restaurant: rest._id, name: 'Напитки', emoji: '🍹', order: 3 },
      { restaurant: rest._id, name: 'Десерты', emoji: '🍰', order: 4 },
    ]);

    const main = cats[0];
    const drinks = cats[2];

    await Food.insertMany([
      { restaurant: rest._id, category: main._id, name: 'Плов', description: 'По-уйгурски, с ягнятиной', price: 45000, image: '/uploads/foods/plov.jpg' },
      { restaurant: rest._id, category: main._id, name: 'Лагман', description: 'Густой, с овощами', price: 38000, image: '/uploads/foods/lagman.jpg' },
      { restaurant: rest._id, category: main._id, name: 'Шашлык (говядина)', description: '2 шампура, с хлебом', price: 52000, image: '/uploads/foods/shashlik.jpg' },
      { restaurant: rest._id, category: main._id, name: 'Манты', description: '6 шт, со сметаной', price: 42000, status: 'out', image: '/uploads/foods/manti.jpg' },
      { restaurant: rest._id, category: main._id, name: 'Норин', description: 'Ручной норин, с мясом', price: 55000, image: '/uploads/foods/norin.jpg' },
      { restaurant: rest._id, category: drinks._id, name: 'Чай', description: 'Чёрный, зелёный', price: 8000, image: '/uploads/foods/chai.jpg' },
      { restaurant: rest._id, category: drinks._id, name: 'Свежий лимонад', description: 'Намат и лимон', price: 18000, image: '/uploads/foods/lemonade.jpg' },
    ]);

    await Table.insertMany([
      { restaurant: rest._id, kind: 'table', name: 'Стол', number: '01', slug: 'T-01' },
      { restaurant: rest._id, kind: 'table', name: 'Стол', number: '02', slug: 'T-02' },
      { restaurant: rest._id, kind: 'table', name: 'Стол', number: '03', slug: 'T-03' },
      { restaurant: rest._id, kind: 'room', name: 'VIP Комната', number: '101', slug: 'X-101' },
    ]);

    console.log('✓ Категории, блюда, столы созданы');
  } else {
    console.log('✓ Ресторан Navvot уже есть — обновляю изображения блюд...');
    const imageMap = {
      'Плов':               '/uploads/foods/plov.jpg',
      'Лагман':             '/uploads/foods/lagman.jpg',
      'Шашлык (говядина)':  '/uploads/foods/shashlik.jpg',
      'Манты':              '/uploads/foods/manti.jpg',
      'Норин':              '/uploads/foods/norin.jpg',
      'Чай':                '/uploads/foods/chai.jpg',
      'Свежий лимонад':     '/uploads/foods/lemonade.jpg',
    };
    let updated = 0;
    for (const [name, image] of Object.entries(imageMap)) {
      const res = await Food.updateOne({ restaurant: rest._id, name }, { $set: { image } });
      if (res.modifiedCount) updated++;
    }
    console.log(`✓ Обновлено изображений: ${updated}/${Object.keys(imageMap).length}`);
  }

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
