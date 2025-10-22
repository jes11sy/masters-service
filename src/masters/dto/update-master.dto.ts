import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray } from 'class-validator';

export class UpdateMasterDto {
  @ApiPropertyOptional({ example: 'Иван Иванов' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'master1' })
  @IsString()
  @IsOptional()
  login?: string;

  @ApiPropertyOptional({ example: 'newpassword123' })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({ example: ['Москва', 'Санкт-Петербург'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  cities?: string[];

  @ApiPropertyOptional({ example: 'работает' })
  @IsString()
  @IsOptional()
  statusWork?: string;

  @ApiPropertyOptional({ example: 'Обновленная заметка' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ example: '123456789' })
  @IsString()
  @IsOptional()
  tgId?: string;

  @ApiPropertyOptional({ example: '123456789' })
  @IsString()
  @IsOptional()
  chatId?: string;

  @ApiPropertyOptional({ example: 'new-passport.pdf' })
  @IsString()
  @IsOptional()
  passportDoc?: string;

  @ApiPropertyOptional({ example: 'new-contract.pdf' })
  @IsString()
  @IsOptional()
  contractDoc?: string;
}

