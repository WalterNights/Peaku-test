import { EmailAlreadyRegisteredError } from '../../domain/errors';
import type { PasswordHasher } from '../../domain/password-hasher';
import { User } from '../../domain/user.entity';
import type { UserRepository } from '../../domain/user.repository';
import { RegisterUserUseCase } from './register-user.use-case';

const createMockRepo = (overrides: Partial<UserRepository> = {}): UserRepository => ({
  findById: jest.fn(),
  findByEmail: jest.fn().mockResolvedValue(null),
  save: jest.fn().mockImplementation((user: User) => Promise.resolve(user)),
  updateRefreshTokenHash: jest.fn(),
  ...overrides,
});

const createMockHasher = (): PasswordHasher => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
});

describe('RegisterUserUseCase', () => {
  it('registers a new user when email is available', async () => {
    const repo = createMockRepo();
    const hasher = createMockHasher();
    const useCase = new RegisterUserUseCase(repo, hasher);

    const result = await useCase.execute({ email: 'New@User.com', password: 'Pass1234!' });

    expect(hasher.hash).toHaveBeenCalledWith('Pass1234!');
    expect(repo.findByEmail).toHaveBeenCalledWith('new@user.com');
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(result.email).toBe('new@user.com');
    expect(result.id).toBeDefined();
  });

  it('throws EmailAlreadyRegisteredError if the email is taken', async () => {
    const existing = User.create({ id: 'abc', email: 'taken@user.com', passwordHash: 'x' });
    const repo = createMockRepo({ findByEmail: jest.fn().mockResolvedValue(existing) });
    const useCase = new RegisterUserUseCase(repo, createMockHasher());

    await expect(
      useCase.execute({ email: 'taken@user.com', password: 'Pass1234!' }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);

    expect(repo.save).not.toHaveBeenCalled();
  });

  it('normalizes email (trim + lowercase) before saving', async () => {
    const repo = createMockRepo();
    const useCase = new RegisterUserUseCase(repo, createMockHasher());

    const result = await useCase.execute({ email: '  Mixed@CASE.com  ', password: 'Pass1234!' });

    expect(repo.findByEmail).toHaveBeenCalledWith('mixed@case.com');
    expect(result.email).toBe('mixed@case.com');
  });

  it('persists firstName / lastName when provided', async () => {
    const repo = createMockRepo();
    const useCase = new RegisterUserUseCase(repo, createMockHasher());

    await useCase.execute({
      email: 'maria@field.com',
      password: 'Pass1234!',
      firstName: 'María',
      lastName: 'Rodríguez',
    });

    const saved = (repo.save as jest.Mock).mock.calls[0][0] as User;
    expect(saved.firstName).toBe('María');
    expect(saved.lastName).toBe('Rodríguez');
  });

  it('trims whitespace from firstName / lastName', async () => {
    const repo = createMockRepo();
    const useCase = new RegisterUserUseCase(repo, createMockHasher());

    await useCase.execute({
      email: 'juan@field.com',
      password: 'Pass1234!',
      firstName: '  Juan  ',
      lastName: '  Pérez  ',
    });

    const saved = (repo.save as jest.Mock).mock.calls[0][0] as User;
    expect(saved.firstName).toBe('Juan');
    expect(saved.lastName).toBe('Pérez');
  });

  it('leaves firstName / lastName undefined when not provided', async () => {
    const repo = createMockRepo();
    const useCase = new RegisterUserUseCase(repo, createMockHasher());

    await useCase.execute({ email: 'anon@field.com', password: 'Pass1234!' });

    const saved = (repo.save as jest.Mock).mock.calls[0][0] as User;
    expect(saved.firstName).toBeUndefined();
    expect(saved.lastName).toBeUndefined();
  });
});
