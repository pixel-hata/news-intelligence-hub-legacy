import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  controllers: [AuthController],
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'dev-only-change-me',
      signOptions: {
        expiresIn: Number(process.env.JWT_EXPIRES_IN_SECONDS || 604800),
      },
    }),
  ],
  exports: [JwtAuthGuard],
  providers: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
