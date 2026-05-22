import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '@peaku/shared';
import type { Request } from 'express';

export interface RequestWithUser extends Request {
  user: JwtPayload;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): JwtPayload => {
  const req = ctx.switchToHttp().getRequest<RequestWithUser>();
  return req.user;
});
