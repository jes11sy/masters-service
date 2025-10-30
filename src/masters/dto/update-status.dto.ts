import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';

export enum MasterStatus {
  WORKING = 'работает',
  FIRED = 'уволен',
  VACATION = 'отпуск',
  SICK_LEAVE = 'больничный',
}

export class UpdateStatusDto {
  @ApiProperty({
    example: 'работает',
    description: 'Статус мастера',
    enum: MasterStatus,
  })
  @IsEnum(MasterStatus, {
    message: 'Недопустимое значение статуса. Допустимые: работает, уволен, отпуск, больничный',
  })
  @IsNotEmpty({ message: 'Статус обязателен' })
  status: MasterStatus;
}

