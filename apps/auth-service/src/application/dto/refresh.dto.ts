import { ApiProperty } from '@nestjs/swagger';
import { IsJWT } from 'class-validator';

export class RefreshDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIs...',
    description: 'Refresh token emitido en /auth/login o el último /auth/refresh.',
  })
  @IsJWT()
  refreshToken!: string;
}
