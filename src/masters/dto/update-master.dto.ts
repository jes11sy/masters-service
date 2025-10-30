import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, MinLength, Matches } from 'class-validator';

export class UpdateMasterDto {
  @ApiPropertyOptional({ example: 'Иван Иванов' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'master1' })
  @IsString()
  @IsOptional()
  login?: string;

  @ApiPropertyOptional({ 
    example: 'NewSecureP@ssw0rd',
    description: 'Минимум 8 символов, должен содержать заглавные и строчные буквы, цифры и спецсимволы'
  })
  @IsString()
  @IsOptional()
  @MinLength(8, { message: 'Пароль должен содержать минимум 8 символов' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    { message: 'Пароль должен содержать заглавные и строчные буквы, цифры и спецсимволы (@$!%*?&)' }
  )
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

