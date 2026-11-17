import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class ResendConfirmationDto {
  @Transform(({ value }) => normalizeEmailInput(value))
  @IsEmail()
  email!: string;
}

function normalizeEmailInput(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}
