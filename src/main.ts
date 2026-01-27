import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import rateLimit from '@fastify/rate-limit';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // ✅ FIX #86: Фильтрация уровней логов в production
  const logLevels: ('log' | 'error' | 'warn' | 'debug' | 'verbose')[] = isProduction
    ? ['log', 'error', 'warn']
    : ['log', 'error', 'warn', 'debug', 'verbose'];

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ 
      logger: !isProduction, // ✅ Fastify logger только в dev
      trustProxy: true,
    }),
    {
      logger: logLevels, // ✅ FIX #86: Применяем фильтрацию логов NestJS
    },
  );

  // 🍪 РЕГИСТРАЦИЯ COOKIE PLUGIN (до CORS!)
  await app.register(require('@fastify/cookie'), {
    secret: process.env.COOKIE_SECRET || process.env.JWT_SECRET,
  });
  logger.log('✅ Cookie plugin registered');

  // 🛡️ RATE LIMITING - защита от DDoS и brute-force
  await app.register(rateLimit, {
    max: 100, // максимум 100 запросов
    timeWindow: '1 minute', // за 1 минуту
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
    }),
    // Кастомный key generator для учёта IP за прокси
    keyGenerator: (request) => {
      return request.headers['x-forwarded-for']?.toString().split(',')[0] 
        || request.ip 
        || 'unknown';
    },
    // Пропускаем health check
    allowList: (request) => {
      return request.url === '/api/v1/masters/health' || request.url === '/metrics';
    },
  });
  logger.log('✅ Rate limiting enabled: 100 req/min');

  // CORS - строгая конфигурация
  const corsOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];
  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Use-Cookies', // 🍪 Поддержка cookie mode
    ],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 86400, // 24 часа
  });

  // Compression для оптимизации
  await app.register(compress, {
    global: true,
    threshold: 1024, // минимум 1KB
    encodings: ['gzip', 'deflate', 'br'],
  });

  // Helmet для безопасности с полной конфигурацией
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation с защитой от Mass Assignment
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );

  // Swagger - только для разработки или с ограничениями для продакшена
  const config = new DocumentBuilder()
    .setTitle('Masters Service API')
    .setDescription('Masters/Employees management microservice')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('api', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
    logger.log('📚 Swagger UI enabled (development mode)');
  } else {
    logger.warn('📚 Swagger UI disabled (production mode)');
  }

  const port = process.env.PORT || 5010;
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Masters Service running on port ${port}`);
  logger.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`🔒 CORS origins: ${corsOrigins.join(', ')}`);
  
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`📚 Swagger: http://localhost:${port}/api`);
  }

  // Graceful Shutdown
  const signals = ['SIGTERM', 'SIGINT'];
  
  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.log(`\n📡 Received ${signal}, starting graceful shutdown...`);
      
      try {
        // Закрываем HTTP сервер
        await app.close();
        logger.log('✅ HTTP server closed');
        
        // Закрываем соединения с БД
        const prismaService = app.get(PrismaService);
        await prismaService.$disconnect();
        logger.log('✅ Database connections closed');
        
        logger.log('👋 Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
      }
    });
  });

  // Обработка необработанных исключений
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (error) => {
    logger.error('❌ Uncaught Exception:', error);
    process.exit(1);
  });
}

bootstrap().catch((error) => {
  logger.error('❌ Failed to start application:', error);
  process.exit(1);
});

