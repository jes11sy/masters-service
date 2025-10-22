# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Установка OpenSSL для Prisma
RUN apk add --no-cache openssl

# Копируем package files
COPY package*.json ./
COPY prisma ./prisma/

# Установка зависимостей
RUN npm ci

# Копируем исходный код
COPY . .

# Генерация Prisma Client
RUN npx prisma generate

# Сборка приложения
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Установка OpenSSL для Prisma
RUN apk add --no-cache openssl

# Создаем непривилегированного пользователя
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

# Копируем только необходимые файлы из builder
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

# Переключаемся на непривилегированного пользователя
USER nestjs

# Открываем порт
EXPOSE 5010

# Запуск приложения
CMD ["node", "dist/main"]

