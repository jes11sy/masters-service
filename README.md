# Masters Service

Микросервис для управления мастерами/сотрудниками.

## Функционал

### 👷 Управление мастерами
- CRUD операции для мастеров
- Управление городами мастеров
- Управление статусом работы (работает/уволен)
- Документы (паспорт, контракт)
- Telegram ID для уведомлений

### 📊 Статистика
- Статистика заказов по мастеру
- Выручка мастера
- Зарплата мастера

### 🔍 Фильтрация
- По городам
- По статусу работы
- Поиск по имени

## API Endpoints

### Health
- `GET /api/v1/health` - health check

### Masters CRUD
- `GET /api/v1/masters` - получить всех мастеров
- `GET /api/v1/masters/:id` - получить мастера по ID
- `POST /api/v1/masters` - создать мастера
- `PUT /api/v1/masters/:id` - обновить мастера
- `DELETE /api/v1/masters/:id` - удалить мастера

### By City
- `GET /api/v1/masters/city/:city` - получить мастеров по городу

### Statistics
- `GET /api/v1/masters/:id/orders` - статистика заказов мастера

### Status
- `PUT /api/v1/masters/:id/status` - обновить статус работы

## Query Parameters

### GET /api/v1/masters
- `city` - фильтр по городу
- `status` - фильтр по статусу (работает/уволен)

### GET /api/v1/masters/:id/orders
- `startDate` - начало периода
- `endDate` - конец периода

## Переменные окружения

```env
DATABASE_URL=postgresql://user:password@localhost:5432/callcentre_crm
JWT_SECRET=your-jwt-secret-key
PORT=5010
CORS_ORIGIN=http://localhost:3000
```

## Запуск

```bash
# Установка зависимостей
npm install

# Генерация Prisma Client
npx prisma generate

# Запуск в dev режиме
npm run start:dev

# Production
npm run build
npm run start:prod
```

## Docker

```bash
# Сборка образа
docker build -t masters-service .

# Запуск контейнера
docker run -d \
  -p 5010:5010 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="secret" \
  masters-service
```

## Swagger

После запуска доступен по адресу: `http://localhost:5010/api`

## Роли

- **DIRECTOR** - полный доступ
- **CALLCENTRE_ADMIN** - просмотр и управление
- **MASTER** - просмотр своей статистики

## Примеры запросов

### Получить всех мастеров
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5010/api/v1/masters
```

### Создать мастера
```bash
curl -X POST http://localhost:5010/api/v1/masters \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Иван Иванов",
    "login": "master1",
    "password": "password123",
    "cities": ["Москва"],
    "statusWork": "работает"
  }'
```

### Получить статистику мастера
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5010/api/v1/masters/1/orders?startDate=2024-01-01&endDate=2024-12-31"
```

