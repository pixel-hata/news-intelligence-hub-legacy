import { IsString, MinLength } from 'class-validator';

export class ConfirmEmailDto {
  @IsString()
  @MinLength(20)
  token!: string;
}
