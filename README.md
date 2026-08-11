# САСАВОТ Community

Полноценная тёмная медиаплатформа комьюнити: лента, категории, вертикальный TikTok-режим, профили, реакции, комментарии, избранное, подписки, поиск, загрузки, жалобы и модерация.

## Быстрый запуск

```bash
npm install
cp .env.example .env
npm start
```

Откройте [http://localhost:3000](http://localhost:3000). По умолчанию включён локальный demo-режим, поэтому PostgreSQL для первого запуска не требуется. Данные сохраняются в `.data/demo.json`.

Для постоянного локального запуска на macOS, который продолжает работать после закрытия терминала:

```bash
npm run start:persistent
```

Остановить фоновый сервер можно командой `npm run stop:persistent`. Если Safari запомнил старую HTTPS-политику для `localhost`, используйте [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Demo-аккаунты

| Роль | Логин | Пароль |
| --- | --- | --- |
| Зритель | `mira_viewer` | `viewer123!` |
| Автор | `melnikova` | `author123!` |
| Модератор | `mod.ksenia` | `mod12345!` |
| Администратор | `admin.sasavot` | `admin12345!` |

Эти данные предназначены только для development. Не переносите тестовые пароли в production.

## PostgreSQL и Prisma

1. Укажите реальный `DATABASE_URL` в `.env`.
2. Выполните:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

Схема в `prisma/schema.prisma` включает пользователей, профили, публикации, комментарии, реакции, закладки, подписки, жалобы, уведомления, сессии и журнал модерации. Текущий запуск использует файловый demo-store. Перед production необходимо подключить Prisma repository к тому же API-контракту и только затем установить `DEMO_MODE=false`.

## Структура

```text
.
├── index.html              SPA shell и SEO metadata
├── server.js               Express API, auth, uploads, moderation
├── css/style.css           tokens, components, responsive states
├── js/app.js               routing, views, API client, interactions
├── assets/images/          original generated media
├── prisma/schema.prisma    production PostgreSQL model
├── prisma/seed.js          development accounts
├── tests/api.test.js       auth, permissions, feed, upload safety
└── .env.example            environment contract
```

## Безопасность

- bcrypt cost 12 для паролей;
- JWT только в `HttpOnly`, `SameSite=Strict` cookie;
- Helmet и строгий CSP;
- rate limiting для API и отдельный лимит входа;
- проверка Origin для изменяющих запросов;
- role-based доступ к модерации;
- MIME определяется по сигнатуре файла, а не по расширению;
- случайные имена загрузок и запрет dotfiles;
- уникальность реакции и жалобы на уровне модели;
- лимиты JSON, текста и файлов;
- API не возвращает email и password hash.

Перед production замените `JWT_SECRET`, настройте HTTPS, S3-совместимое хранилище, email provider, FFmpeg worker, антивирусную проверку и отдельную очередь обработки медиа.

## Проверка

```bash
npm test
```

Ручные сценарии: вход через demo-кнопки, реакция на пост, закладка, комментарий, публикация файла, поиск, профиль автора, уведомления и очередь модерации под `mod.ksenia`.

## Следующая версия

- подтверждение email и восстановление пароля через provider;
- транскодирование видео и adaptive streaming;
- real-time уведомления через WebSocket;
- полнотекстовый поиск PostgreSQL;
- Redis для rate limit, сессий и hot score;
- объектное хранилище и CDN;
- PWA и будущая Telegram-интеграция.
