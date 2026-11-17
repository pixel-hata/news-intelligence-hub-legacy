import type {
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedUser } from './authenticated-user';

interface RequestWithAuthHeader {
  headers: {
    authorization?: string;
  };
  user?: AuthenticatedUser;
}

interface JwtPayload {
  sub: string;
  email: string;
  sessionVersion?: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithAuthHeader>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      const user = await this.prisma.user.findUnique({
        select: {
          emailConfirmedAt: true,
          sessionVersion: true,
        },
        where: {
          id: payload.sub,
        },
      });

      if (
        !user ||
        !user.emailConfirmedAt ||
        user.sessionVersion !== payload.sessionVersion
      ) {
        throw new UnauthorizedException('Invalid bearer token');
      }

      request.user = {
        email: payload.email,
        id: payload.sub,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid bearer token');
    }
  }

  private extractBearerToken(header?: string): string | null {
    if (!header) {
      return null;
    }

    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }
}
