import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MastersModule } from './masters/masters.module';
import { MasterHandoverController } from './master-handover/master-handover.controller';
import { MastersService } from './masters/masters.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrometheusModule.register({
      defaultMetrics: { enabled: true },
      path: '/metrics',
    }),
    PrismaModule,
    AuthModule,
    MastersModule,
  ],
  controllers: [MasterHandoverController],
  providers: [MastersService],
})
export class AppModule {}

