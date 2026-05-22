import { InvalidCredentialsError } from '../../domain/errors';
import type { PasswordHasher } from '../../domain/password-hasher';
import type { AuthTokens, TokenService } from '../../domain/token-service';
import { User } from '../../domain/user.entity';
import type { UserRepository } from '../../domain/user.repository';
import { LoginUserUseCase } from './login-user.use-case';

const validTokens: AuthTokens = { accessToken: 'access', refreshToken: 'refresh' };

const buildUser = (overrides: Partial<{ passwordHash: string }> = {}): User =>
  User.create({
    id: 'user-1',
    email: 'someone@peaku.test',
    passwordHash: overrides.passwordHash ?? 'stored-hash',
  });

const createMockRepo = (user: User | null): UserRepository => ({
  findById: jest.fn(),
  findByEmail: jest.fn().mockResolvedValue(user),
  save: jest.fn(),
  updateRefreshTokenHash: jest.fn().mockResolvedValue(undefined),
});

const createMockHasher = (matches: boolean): PasswordHasher => ({
  hash: jest.fn().mockResolvedValue('new-hash'),
  compare: jest.fn().mockResolvedValue(matches),
});

const createMockTokens = (): TokenService => ({
  signAccessToken: jest.fn(),
  signRefreshToken: jest.fn(),
  signPair: jest.fn().mockResolvedValue(validTokens),
  verifyAccessToken: jest.fn(),
  verifyRefreshToken: jest.fn(),
});

describe('LoginUserUseCase', () => {
  it('returns tokens on valid credentials and persists refresh hash', async () => {
    const user = buildUser();
    const repo = createMockRepo(user);
    const hasher = createMockHasher(true);
    const tokens = createMockTokens();
    const useCase = new LoginUserUseCase(repo, hasher, tokens);

    const result = await useCase.execute({ email: 'someone@peaku.test', password: 'Pass1234!' });

    expect(result).toEqual(validTokens);
    expect(repo.updateRefreshTokenHash).toHaveBeenCalledWith('user-1', 'new-hash');
  });

  it('throws InvalidCredentialsError when password does not match', async () => {
    const user = buildUser();
    const useCase = new LoginUserUseCase(createMockRepo(user), createMockHasher(false), createMockTokens());

    await expect(useCase.execute({ email: 'x@x.com', password: 'wrong' })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });

  it('throws InvalidCredentialsError if user does not exist (without revealing existence)', async () => {
    const hasher = createMockHasher(true);
    const useCase = new LoginUserUseCase(createMockRepo(null), hasher, createMockTokens());

    await expect(useCase.execute({ email: 'ghost@peaku.test', password: 'x' })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );

    // Comparamos contra hash dummy igualmente para mitigar timing attacks.
    expect(hasher.compare).toHaveBeenCalled();
  });
});
