# Masters Service - Deployment Guide

## 🎯 Описание

Микросервис для управления мастерами/сотрудниками CRM системы.

## 📋 Функционал

### ✅ Управление мастерами
- CRUD операции
- Управление городами
- Управление статусом (работает/уволен)
- Документы (паспорт, контракт)
- Telegram интеграция

### ✅ Статистика
- Заказы по мастеру
- Выручка
- Зарплата (сдача мастера)

---

## 🚀 Локальная установка

### 1. Установка зависимостей

```bash
cd api-services/masters-service
npm install
```

### 2. Настройка окружения

Создайте `.env` файл:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/callcentre_crm

# JWT
JWT_SECRET=your-jwt-secret-key

# Server
PORT=5010
CORS_ORIGIN=http://localhost:3000
```

### 3. Prisma миграция

```bash
npx prisma generate
npx prisma db push
```

### 4. Запуск

```bash
npm run start:dev
```

---

## 🐳 Docker Deployment

### 1. Сборка образа

```bash
docker build -t your-registry/masters-service:latest .
```

### 2. Запуск контейнера

```bash
docker run -d \
  --name masters-service \
  -p 5010:5010 \
  -e DATABASE_URL="postgresql://user:pass@postgres:5432/db" \
  -e JWT_SECRET="your-secret" \
  your-registry/masters-service:latest
```

---

## ☸️ Kubernetes Deployment

### 1. Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: masters-service-secrets
  namespace: crm
type: Opaque
stringData:
  DATABASE_URL: "postgresql://user:pass@postgres:5432/db"
  JWT_SECRET: "your-jwt-secret"
```

### 2. Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: masters-service
  namespace: crm
spec:
  replicas: 2
  selector:
    matchLabels:
      app: masters-service
  template:
    metadata:
      labels:
        app: masters-service
    spec:
      containers:
      - name: masters-service
        image: your-registry/masters-service:latest
        ports:
        - containerPort: 5010
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: masters-service-secrets
              key: DATABASE_URL
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: masters-service-secrets
              key: JWT_SECRET
        - name: PORT
          value: "5010"
        - name: CORS_ORIGIN
          value: "https://test-shem.ru"
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/v1/health
            port: 5010
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/v1/health
            port: 5010
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: masters-service
  namespace: crm
spec:
  selector:
    app: masters-service
  ports:
  - protocol: TCP
    port: 5010
    targetPort: 5010
```

### 3. Apply

```bash
kubectl apply -f k8s/secrets/masters-service-secrets.yaml
kubectl apply -f k8s/deployments/masters-service.yaml
```

---

## 📊 API Examples

### 1. Получить всех мастеров

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:5010/api/v1/masters"
```

**Ответ:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Иван Иванов",
      "cities": ["Москва", "Санкт-Петербург"],
      "statusWork": "работает",
      "tgId": "123456789"
    }
  ],
  "total": 1
}
```

### 2. Создать мастера

```bash
curl -X POST http://localhost:5010/api/v1/masters \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Петр Петров",
    "login": "master2",
    "password": "password123",
    "cities": ["Москва"],
    "statusWork": "работает",
    "tgId": "987654321"
  }'
```

### 3. Получить мастеров по городу

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:5010/api/v1/masters/city/Москва"
```

### 4. Статистика мастера

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:5010/api/v1/masters/1/orders?startDate=2024-01-01&endDate=2024-12-31"
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "master": {
      "id": 1,
      "name": "Иван Иванов",
      "cities": ["Москва"]
    },
    "orders": {
      "total": 150,
      "completed": 120,
      "inProgress": 10
    },
    "revenue": {
      "total": 1500000,
      "clean": 1200000,
      "masterChange": 300000
    }
  }
}
```

### 5. Обновить статус

```bash
curl -X PUT http://localhost:5010/api/v1/masters/1/status \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "уволен"}'
```

---

## 🔧 Интеграция с Orders Service

Masters Service работает с Orders Service для получения статистики:

```typescript
// В Orders Service при назначении мастера
POST /api/v1/orders/:id/assign-master
{
  "masterId": 1
}

// Masters Service запрашивает статистику через Prisma
const orders = await prisma.order.findMany({
  where: { masterId: 1 }
});
```

---

## 🐛 Troubleshooting

### Ошибка: "Cannot delete master with orders"

**Проблема:** Попытка удалить мастера с заказами

**Решение:**
```bash
# Вместо удаления измените статус
curl -X PUT http://localhost:5010/api/v1/masters/1/status \
  -H "Authorization: Bearer <token>" \
  -d '{"status": "уволен"}'
```

### Мастер не отображается в списке

**Проблема:** Фильтр по статусу или городу

**Решение:**
```bash
# Проверьте фильтры
curl "http://localhost:5010/api/v1/masters?status=all&city=all"
```

---

## ✅ Проверка работоспособности

```bash
# 1. Health check
curl http://localhost:5010/api/v1/health

# 2. Получить мастеров
curl -H "Authorization: Bearer <token>" \
  http://localhost:5010/api/v1/masters

# 3. Swagger UI
open http://localhost:5010/api
```

---

## 🔄 CI/CD

См. `.github/workflows/docker-build.yml`

---

## 📚 Полезные ссылки

- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)

