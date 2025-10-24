import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MastersModule } from './masters/masters.module';
import { MasterHandoverController } from './master-handover/master-handover.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    MastersModule,
  ],
  controllers: [MasterHandoverController],
})
export class AppModule {}

