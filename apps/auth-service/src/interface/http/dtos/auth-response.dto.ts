import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { USER_ROLES, type UserRole } from '@peaku/shared';

export class AuthTokensResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIs...', description: 'JWT de acceso (TTL: 15m).' })
  accessToken!: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIs...', description: 'JWT de refresh (TTL: 7d).' })
  refreshToken!: string;
}

export class AccessTokenResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIs...' })
  accessToken!: string;
}

export class UserProfileResponseDto {
  @ApiProperty({ example: '65f1a2b3c4d5e6f7a8b9c0d1' })
  id!: string;

  @ApiProperty({ example: 'admin@peaku.test' })
  email!: string;

  @ApiProperty({ example: 'user', enum: USER_ROLES })
  role!: UserRole;

  @ApiPropertyOptional({ example: 'María' })
  firstName?: string;

  @ApiPropertyOptional({ example: 'Rodríguez' })
  lastName?: string;

  @ApiProperty({ example: '2026-05-20T20:00:00.000Z', type: String, format: 'date-time' })
  createdAt!: string;
}
