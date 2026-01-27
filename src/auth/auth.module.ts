import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';
import { CookieJwtAuthGuard } from './guards/cookie-jwt-auth.guard';

@Module({
  imports: [
    PassportModule,
    // JWT_SECRET обязателен - без fallback для безопасности
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required');
        }
        if (secret.length < 32) {
          throw new Error('JWT_SECRET must be at least 32 characters long');
        }
        return {
          secret,
          signOptions: { expiresIn: '24h' },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [JwtStrategy, RolesGuard, CookieJwtAuthGuard],
  exports: [JwtModule, RolesGuard, CookieJwtAuthGuard],
})
export class AuthModule {}

