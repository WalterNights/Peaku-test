import { ApiProperty } from '@nestjs/swagger';
import { USER_ROLES, type UserRole } from '@peaku/shared';
import { IsIn } from 'class-validator';

export class SwitchRoleDto {
  @ApiProperty({
    example: 'admin',
    enum: USER_ROLES,
    description: 'Nuevo rol a asignar al usuario autenticado.',
  })
  @IsIn(USER_ROLES)
  role!: UserRole;
}
