# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Установка OpenSSL для Prisma
# hadolint ignore=DL3018
RUN apk add --no-cache openssl

# Копируем package files
COPY package*.json ./
COPY prisma ./prisma/

# Установка зависимостей
RUN npm install

# Копируем исходный код
COPY . .

# Генерация Prisma Client и сборка приложения
RUN npx prisma generate && npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Установка OpenSSL для Prisma
# hadolint ignore=DL3018
RUN apk add --no-cache openssl

# Создаем непривилегированного пользователя
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

# ✅ FIX #109: Копируем только необходимые файлы (без node_modules)
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

# ✅ FIX #109: Устанавливаем ТОЛЬКО production зависимости
RUN npm ci --only=production --ignore-scripts && \
    npx prisma generate && \
    npm cache clean --force

# Переключаемся на непривилегированного пользователя
USER nestjs

# Открываем порт
EXPOSE 5010

# Запуск приложения
CMD ["node", "dist/main"]

