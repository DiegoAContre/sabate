import { beforeEach, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import {
  changePassword,
  loginUser,
  registerUser,
} from '../src/services/authService.js';
import { createUser, truncateAll, unique } from './db.js';

beforeEach(truncateAll);

function registerInput(email: string) {
  return { email, name: 'Test User', password: 'password123' };
}

describe('registerUser', () => {
  it('creates a user and returns user data plus a JWT, without the hash', async () => {
    const email = `reg-${unique()}@test.dev`;
    const { user, token } = await registerUser(registerInput(email));

    expect(user.email).toBe(email);
    expect(user.role).toBe('user');
    expect(user).not.toHaveProperty('passwordHash');
    expect(token.split('.')).toHaveLength(3); // JWT
  });

  it('rejects duplicate email with 409', async () => {
    const email = `dup-${unique()}@test.dev`;
    const input = registerInput(email);

    await registerUser(input);
    await expect(registerUser(input)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Email already registered',
    });
  });
});

describe('loginUser', () => {
  it('logs in with valid credentials', async () => {
    const user = await createUser();
    const { user: out, token } = await loginUser({
      email: user.email,
      password: 'password123',
    });

    expect(out.id).toBe(user.id);
    expect(token.split('.')).toHaveLength(3);
  });

  it('rejects a wrong password with 401', async () => {
    const user = await createUser();
    await expect(
      loginUser({ email: user.email, password: 'wrongpassword' }),
    ).rejects.toMatchObject({ statusCode: 401, message: 'Invalid credentials' });
  });

  it('rejects disabled accounts with 401', async () => {
    const user = await createUser({ isActive: false });
    await expect(
      loginUser({ email: user.email, password: 'password123' }),
    ).rejects.toMatchObject({ statusCode: 401, message: 'Account disabled' });
  });
});

describe('changePassword', () => {
  it('rejects a wrong current password with 401', async () => {
    const user = await createUser();
    await expect(
      changePassword(user.id, {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword1',
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: 'Current password is incorrect',
    });
  });

  it('changes it: the old password stops working, the new one logs in', async () => {
    const user = await createUser();

    await changePassword(user.id, {
      currentPassword: 'password123',
      newPassword: 'newpassword1',
    });
    await expect(
      loginUser({ email: user.email, password: 'password123' }),
    ).rejects.toMatchObject({ statusCode: 401 });
    await expect(
      loginUser({ email: user.email, password: 'newpassword1' }),
    ).resolves.toMatchObject({ user: { id: user.id } });
  });
});

// Sanity: bcrypt fixture hashes verify for the helper itself.
it('createUser fixture uses the documented password', async () => {
  const user = await createUser();
  await expect(bcrypt.compare('password123', user.passwordHash)).resolves.toBe(true);
});
