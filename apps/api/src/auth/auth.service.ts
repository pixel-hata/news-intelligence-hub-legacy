import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  seedAxisLabels,
  seedCategories,
  seedCategorizationAxes,
} from '@nih/shared';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';

import { PrismaService } from '../database/prisma.service';
import type { ConfirmEmailDto } from './dto/confirm-email.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { ResendConfirmationDto } from './dto/resend-confirmation.dto';

interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  emailConfirmed: boolean;
}

interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}

interface RegisterResponse {
  user: PublicUser;
  devEmailConfirmation: {
    token: string;
    endpoint: string;
  };
}

interface PrismaUniqueError {
  code?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResponse> {
    const email = this.normalizeEmail(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const confirmationToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(confirmationToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            displayName: dto.displayName?.trim() || null,
            email,
            passwordHash,
          },
        });

        await tx.emailConfirmationToken.create({
          data: {
            expiresAt,
            tokenHash,
            userId: createdUser.id,
          },
        });

        await tx.category.createMany({
          data: seedCategories.map((category) => ({
            ...category,
            userId: createdUser.id,
          })),
          skipDuplicates: true,
        });

        for (const axis of seedCategorizationAxes) {
          await tx.categorizationAxis.create({
            data: {
              description: axis.description,
              isActive: axis.isActive,
              labels: {
                create: (seedAxisLabels[axis.name] ?? []).map(
                  (name, index) => ({
                    name,
                    sortOrder: (index + 1) * 10,
                  }),
                ),
              },
              name: axis.name,
              prompt: axis.prompt,
              sortOrder: axis.sortOrder,
              userId: createdUser.id,
            },
          });
        }

        return createdUser;
      });

      return {
        user: this.toPublicUser(user),
        devEmailConfirmation: {
          token: confirmationToken,
          endpoint: '/api/auth/confirm-email',
        },
      };
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async confirmEmail(dto: ConfirmEmailDto): Promise<{ user: PublicUser }> {
    const tokenHash = this.hashToken(dto.token);
    const confirmation = await this.prisma.emailConfirmationToken.findFirst({
      include: {
        user: true,
      },
      where: {
        expiresAt: {
          gt: new Date(),
        },
        tokenHash,
        usedAt: null,
      },
    });

    if (!confirmation) {
      throw new BadRequestException('Confirmation token is invalid or expired');
    }

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.emailConfirmationToken.update({
        data: {
          usedAt: new Date(),
        },
        where: {
          id: confirmation.id,
        },
      });

      return tx.user.update({
        data: {
          emailConfirmedAt: confirmation.user.emailConfirmedAt ?? new Date(),
        },
        where: {
          id: confirmation.userId,
        },
      });
    });

    return {
      user: this.toPublicUser(user),
    };
  }

  async resendConfirmation(
    dto: ResendConfirmationDto,
  ): Promise<{
    devEmailConfirmation: {
      endpoint: string;
      token: string;
    };
    user: PublicUser;
  }> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      throw new BadRequestException('Account was not found');
    }
    if (user.emailConfirmedAt) {
      throw new BadRequestException('Email is already confirmed');
    }

    const confirmationToken = randomBytes(32).toString('base64url');
    await this.prisma.emailConfirmationToken.create({
      data: {
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        tokenHash: this.hashToken(confirmationToken),
        userId: user.id,
      },
    });

    return {
      devEmailConfirmation: {
        endpoint: '/api/auth/confirm-email',
        token: confirmationToken,
      },
      user: this.toPublicUser(user),
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.emailConfirmedAt) {
      throw new UnauthorizedException('Email is not confirmed');
    }

    return {
      accessToken: await this.jwtService.signAsync({
        email: user.email,
        sessionVersion: user.sessionVersion,
        sub: user.id,
      }),
      user: this.toPublicUser(user),
    };
  }

  async logout(userId: string): Promise<{ ok: true }> {
    await this.prisma.user.updateMany({
      data: {
        sessionVersion: {
          increment: 1,
        },
      },
      where: {
        id: userId,
      },
    });

    return { ok: true };
  }

  async me(userId: string): Promise<{ user: PublicUser }> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid bearer token');
    }

    return {
      user: this.toPublicUser(user),
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private isUniqueError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as PrismaUniqueError).code === 'P2002'
    );
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    displayName: string | null;
    emailConfirmedAt: Date | null;
  }): PublicUser {
    return {
      displayName: user.displayName,
      email: user.email,
      emailConfirmed: Boolean(user.emailConfirmedAt),
      id: user.id,
    };
  }
}
