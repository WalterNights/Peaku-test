import type { UserRole } from '@peaku/shared';

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  refreshTokenHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly role: UserRole;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly refreshTokenHash: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: UserProps) {
    this.id = props.id;
    this.email = props.email;
    this.passwordHash = props.passwordHash;
    this.role = props.role;
    this.firstName = props.firstName;
    this.lastName = props.lastName;
    this.refreshTokenHash = props.refreshTokenHash;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static restore(props: UserProps): User {
    return new User(props);
  }

  static create(params: {
    id: string;
    email: string;
    passwordHash: string;
    role?: UserRole;
    firstName?: string;
    lastName?: string;
    now?: Date;
  }): User {
    const now = params.now ?? new Date();
    return new User({
      id: params.id,
      email: params.email.trim().toLowerCase(),
      passwordHash: params.passwordHash,
      role: params.role ?? 'user',
      firstName: params.firstName?.trim() || undefined,
      lastName: params.lastName?.trim() || undefined,
      refreshTokenHash: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  withRefreshTokenHash(hash: string | null, now: Date = new Date()): User {
    return new User({
      id: this.id,
      email: this.email,
      passwordHash: this.passwordHash,
      role: this.role,
      firstName: this.firstName,
      lastName: this.lastName,
      refreshTokenHash: hash,
      createdAt: this.createdAt,
      updatedAt: now,
    });
  }
}
