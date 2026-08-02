# Запуск без компьютера (iPad, iPhone)

Два пути. Первый — быстрее попробовать, второй — постоянный адрес и работа с телефона.

---

## Вариант A. Codespaces — посмотреть прямо сейчас (5 минут)

Полноценная среда в браузере Safari, ничего ставить не нужно. У GitHub есть
бесплатный лимит (60 часов в месяц на аккаунт).

1. Открой репозиторий на github.com в Safari.
2. Переключись на ветку `claude/emiliya-life-os-build-ikmidi`.
3. Кнопка **Code** → вкладка **Codespaces** → **Create codespace on branch**.
4. Подожди 2–3 минуты. Контейнер сам поставит зависимости, создаст базу с
   тестовыми данными и запустит `npm run dev` — это прописано в
   `.devcontainer/devcontainer.json`.
5. Внизу появится вкладка **Ports** → у порта 3000 нажми на глобус.
   Откроется приложение.
6. Вход: `emiliya.shramkoo@gmail.com` / `lifeos123`.

Минус: Codespace засыпает без активности, адрес временный, база живёт внутри
контейнера. Это способ посмотреть и потрогать, а не пользоваться каждый день.

---

## Вариант B. Vercel + Neon — постоянный адрес (20–30 минут)

Всё делается в Safari, без терминала. Обе услуги имеют бесплатный тариф,
которого для одного пользователя хватает с запасом.

### 1. База данных (Neon)

1. `neon.tech` → зарегистрируйся через GitHub.
2. **Create project**, регион — Frankfurt (ближе всего к Хельсинки).
3. Скопируй **Connection string** — строка вида
   `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`.

SQLite здесь не подойдёт: на Vercel файловая система эфемерная, база стёрлась бы
при каждом деплое. Схема заранее написана Postgres-совместимо, поэтому переход —
это только строка подключения; `npm run vercel-build` сам переключит provider и
создаст таблицы.

### 2. Приложение (Vercel)

1. `vercel.com` → **Add New → Project** → импортируй репозиторий.
2. **Root Directory**: укажи `life-os` (важно — проект лежит в подпапке).
3. **Environment Variables** — добавь:

   | Переменная | Значение |
   |---|---|
   | `DATABASE_URL` | строка подключения из Neon |
   | `AUTH_SECRET` | любая длинная случайная строка (64 символа) |
   | `SETUP_TOKEN` | придумай временный пароль, понадобится один раз |
   | `APP_URL` | `https://<имя-проекта>.vercel.app` |
   | `ANTHROPIC_API_KEY` | ключ, если хочешь включить AI (необязательно) |

4. **Deploy**. Vercel сам найдёт скрипт `vercel-build` и создаст таблицы.

### 3. Создать свой аккаунт

Сид-скрипт с тестовыми данными для этого не нужен — на хостинге создаётся пустая
рабочая система: агенты, области и базовые правила, без выдуманных проектов.

Открой в Safari приложение **Shortcuts** (или любой HTTP-клиент) и отправь один
запрос. В Shortcuts: новая команда → действие **Get Contents of URL**:

- URL: `https://<твой-адрес>.vercel.app/api/setup`
- Method: `POST`
- Headers: `x-setup-token` = значение `SETUP_TOKEN`
- Request Body → JSON:
  - `email` = твой email
  - `password` = твой пароль (минимум 8 символов)

В ответе придёт `"createdUser": true`.

### 4. Закрыть дверь

Вернись в Vercel → Settings → Environment Variables → **удали `SETUP_TOKEN`** →
Redeploy. Без этой переменной endpoint `/api/setup` отвечает 404 и создать
второй аккаунт через него невозможно.

### 5. На домашний экран

Открой адрес в Safari → **Поделиться** → **На экран «Домой»**. Приложение
запустится в отдельном окне без адресной строки, с нижней навигацией.

---

## Telegram — работать с телефона голосом

После деплоя бот даёт самый быстрый ввод: надиктовал в Telegram, расшифровка
ушла в Inbox Agent.

1. В Telegram напиши `@BotFather` → `/newbot` → скопируй токен.
2. В Vercel добавь переменные `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`
   (придумай строку) и `TELEGRAM_ALLOWED_CHAT_ID` (свой id, узнать у `@userinfobot`).
3. Redeploy.
4. Открой в Safari один раз ссылку:

```
https://api.telegram.org/bot<ТОКЕН>/setWebhook?url=https://<адрес>.vercel.app/api/telegram/webhook&secret_token=<СЕКРЕТ>
```

Должно вернуться `{"ok":true}`. После этого работают `/today`, `/week`, `/add`,
`/idea`, `/content`, `/done`, `/energy`, `/inbox`, `/review`, `/approve`,
`/cancel` и обычные сообщения.

---

## Google Calendar

1. `console.cloud.google.com` → новый проект → **APIs & Services** →
   включи **Google Calendar API**.
2. **Credentials** → **Create OAuth client ID** → тип **Web application**.
3. Authorized redirect URI: `https://<адрес>.vercel.app/api/integrations/google/callback`
4. Добавь в Vercel `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `GOOGLE_REDIRECT_URI`, сделай Redeploy.
5. В приложении: **Настройки** → **Подключить Google Calendar**.

---

## Что помнить

- `npm run vercel-build` выполняет `prisma db push` на каждом деплое. Для одного
  пользователя это удобно, но это не миграции: если понадобится история
  изменений схемы, переходи на `prisma migrate`.
- Бесплатный Neon усыпляет базу при простое — первый запрос после паузы может
  идти несколько секунд.
- `SETUP_TOKEN` должен существовать только на время шага 3.
