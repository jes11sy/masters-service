import { Injectable, UnauthorizedException, OnModuleInit, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) implements OnModuleInit {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor() {
    // Валидация JWT_SECRET при инициализации
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    
    if (jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  onModuleInit() {
    this.logger.log('✅ JWT Strategy initialized with secure secret');
  }

  async validate(payload: any) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Проверяем обязательные поля
    if (!payload.role) {
      throw new UnauthorizedException('Token missing required role');
    }

    // Логируем событие аутентификации
    this.logger.log({
      action: 'TOKEN_VALIDATED',
      userId: payload.sub,
      role: payload.role,
      timestamp: new Date().toISOString(),
    });

    return {
      userId: payload.sub,
      login: payload.login,
      role: payload.role,
      cities: payload.cities,
    };
  }
}

