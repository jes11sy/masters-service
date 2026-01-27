import { Module } from '@nestjs/common';
import { MastersController } from './masters.controller';
import { MastersService } from './masters.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MastersController],
  providers: [MastersService],
  exports: [MastersService], // Экспортируем для MasterHandoverController
})
export class MastersModule {}

