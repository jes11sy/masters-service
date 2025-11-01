import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // ✅ ОПТИМИЗИРОВАНО: Masters Service - средняя нагрузка
    // Управление мастерами, их расписанием и назначениями
    const databaseUrl = process.env.DATABASE_URL || '';
    const hasParams = databaseUrl.includes('?');
    
    const connectionParams = [
      'connection_limit=25',      // Умеренно-высокое значение
      'pool_timeout=20',
      'connect_timeout=10',
      'socket_timeout=60',
    ];
    
    const needsParams = !databaseUrl.includes('connection_limit');
    const enhancedUrl = needsParams
      ? `${databaseUrl}${hasParams ? '&' : '?'}${connectionParams.join('&')}`
      : databaseUrl;

    super({
      datasources: {
        db: {
          url: enhancedUrl,
        },
      },
      log: [
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ],
      errorFormat: 'minimal',
    });

    if (needsParams) {
      this.logger.log('✅ Connection pool configured: limit=25');
    }

    // Query Performance Monitoring
    this.$use(async (params, next) => {
      const before = Date.now();
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout: exceeded 15 seconds')), 15000)
      );

      try {
        const result = await Promise.race([next(params), timeout]);
        const duration = Date.now() - before;

        if (duration > 1000) {
          this.logger.warn(`⚠️ Slow query: ${params.model}.${params.action} took ${duration}ms`);
        }

        return result;
      } catch (error) {
        const duration = Date.now() - before;
        if (error instanceof Error && error.message.includes('Query timeout')) {
          this.logger.error(`❌ Query timeout: ${params.model}.${params.action} after ${duration}ms`);
        } else {
          this.logger.error(`❌ Query failed after ${duration}ms`, error);
        }
        throw error;
      }
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Database connected successfully');
      this.logger.log('✅ Masters Service ready');
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

