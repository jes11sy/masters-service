import { IsArray, IsDateString, IsBoolean, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ScheduleDayDto {
  @ApiProperty({ example: '2026-01-27', description: 'Дата в формате YYYY-MM-DD' })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: true, description: 'true = рабочий день, false = выходной' })
  @IsBoolean()
  isWorkDay!: boolean;
}

export class UpdateScheduleDto {
  @ApiProperty({ type: [ScheduleDayDto], description: 'Массив дней расписания' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleDayDto)
  days!: ScheduleDayDto[];
}

export class GetScheduleQueryDto {
  @ApiProperty({ example: '2026-01-01', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ example: '2026-01-31', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
