import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ],
      errorFormat: 'minimal',
    });

    // Логирование медленных запросов
    this.$on('query' as never, (e: any) => {
      if (e.duration > 1000) {
        this.logger.warn({
          message: 'Slow query detected',
          duration: `${e.duration}ms`,
          query: e.query.substring(0, 200), // первые 200 символов
          params: e.params,
        });
      }
    });

    // Middleware для timeout
    this.$use(async (params, next) => {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout: exceeded 10 seconds')), 10000)
      );

      try {
        return await Promise.race([next(params), timeout]);
      } catch (error) {
        if (error instanceof Error && error.message.includes('Query timeout')) {
          this.logger.error({
            message: 'Query timeout',
            model: params.model,
            action: params.action,
          });
        }
        throw error;
      }
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Database connected successfully');
      this.logger.log(`📊 Connection pool configured from DATABASE_URL`);
    } catch (error) {
      this.logger.error('❌ Database connection failed', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('👋 Database disconnected');
  }
}

