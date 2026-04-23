# Menu Backend

Простой API для системы электронного меню (Node.js + Express + MongoDB + AES).

## Стек
- Node.js + Express
- MongoDB (Mongoose)
- JWT для авторизации
- AES-256-CBC для шифрования паролей (обратимо — super-admin может показать пароль ресторану)

## Запуск
```bash
cd backend
cp .env.example .env          # отредактируйте MONGO_URI и секреты
npm install
npm run seed                   # создать super-admin и тестовый ресторан
npm run dev                    # http://localhost:5000
```

По умолчанию:
- Super admin: `admin@menu.app` / `admin123`
- Ресторан Navvot: `admin@navvot.uz` / `navvot123`

## Роли
- `system` — super admin (CRUD ресторанов)
- `restaurant` — админ ресторана (столы, меню, заказы)
- публичный — клиент (QR → меню → заказ)

## API

### Auth
- `POST /api/auth/system/login` — вход супер-админа
- `POST /api/auth/restaurant/login` — вход админа ресторана

### System (требуется `system` токен)
- `GET /api/system/regions` — список регионов
- `GET /api/system/stats` — счётчики ресторанов
- `GET /api/system/restaurants?q=&status=` — список
- `GET /api/system/restaurants/:id` — детали + расшифрованный пароль
- `POST /api/system/restaurants` — создать (тело: `brandName, email, password, region, phone, address, logo, description`)
- `PATCH /api/system/restaurants/:id` — обновить (brandName, region, status, address, phone, logo)
- `POST /api/system/restaurants/:id/reset-password` — смена пароля
- `DELETE /api/system/restaurants/:id` — удалить (с каскадом)

### Restaurant (требуется `restaurant` токен)
- `GET /api/restaurant/me` — профиль
- `PATCH /api/restaurant/me` — обновить профиль/настройки
- `POST /api/restaurant/change-password` — сменить пароль
- `GET /api/restaurant/stats` — дашборд
- `GET|POST|PATCH|DELETE /api/restaurant/tables[/:id]`
- `GET|POST|PATCH|DELETE /api/restaurant/categories[/:id]`
- `GET|POST|PATCH|DELETE /api/restaurant/foods[/:id]`
- `GET /api/restaurant/orders?status=new|seen`
- `POST /api/restaurant/orders/:id/seen`

### Public (гость/клиент)
- `GET /api/public/menu/:restaurantId/:tableSlug` — получить меню по QR
- `POST /api/public/orders` — отправить заказ (тело: `restaurantId, tableId, items[{food,qty}], comment`)
- `GET /api/public/qr/:restaurantId/:tableSlug.png` — QR изображение

## Регионы
`UZ | RU | KZ | KG | TJ | US` — каждый автоматически выставляет телефонный префикс, формат, валюту (символ и код) и часовой пояс. Ресторан может переопределить в настройках.
