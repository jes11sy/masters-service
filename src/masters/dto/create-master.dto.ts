import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsNotEmpty, MinLength, Matches, ValidateIf } from 'class-validator';

export class CreateMasterDto {
  @ApiProperty({ example: 'Иван Иванов' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'master1' })
  @IsString()
  @IsOptional()
  login?: string;

  @ApiPropertyOptional({ 
    example: 'SecureP@ssw0rd',
    description: 'Минимум 8 символов, должен содержать заглавные и строчные буквы, цифры и спецсимволы'
  })
  @ValidateIf(o => o.login !== undefined)
  @IsNotEmpty({ message: 'Пароль обязателен при указании логина' })
  @IsString()
  @MinLength(8, { message: 'Пароль должен содержать минимум 8 символов' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    { message: 'Пароль должен содержать заглавные и строчные буквы, цифры и спецсимволы (@$!%*?&)' }
  )
  password?: string;

  @ApiProperty({ example: ['Москва', 'Санкт-Петербург'] })
  @IsArray()
  @IsString({ each: true })
  cities!: string[];

  @ApiPropertyOptional({ example: 'работает', default: 'работает' })
  @IsString()
  @IsOptional()
  statusWork?: string;

  @ApiPropertyOptional({ example: 'Опытный мастер' })
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

  @ApiPropertyOptional({ example: 'passport.pdf' })
  @IsString()
  @IsOptional()
  passportDoc?: string;

  @ApiPropertyOptional({ example: 'contract.pdf' })
  @IsString()
  @IsOptional()
  contractDoc?: string;
}

