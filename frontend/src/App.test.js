/**
 * Smoke tests for the application shell.
 *
 * This file used to contain Create React App's default test ("renders learn
 * react link"), which had never been updated and therefore always failed. CI
 * builds the frontend but does not run its tests, so nothing surfaced it.
 *
 * These assert the two things that must be true of the shell before any page
 * can work: it renders without throwing, and an unauthenticated visitor is kept
 * out of a protected route.
 */

import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

// The app boots by verifying any stored token against /api/auth/me. Stub the
// network so the test does not depend on a running backend.
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: () => ({
      interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
      get: jest.fn().mockResolvedValue({ data: { success: true } }),
      post: jest.fn().mockResolvedValue({ data: { success: true } }),
      put: jest.fn().mockResolvedValue({ data: { success: true } }),
      patch: jest.fn().mockResolvedValue({ data: { success: true } }),
      delete: jest.fn().mockResolvedValue({ data: { success: true } }),
    }),
    get: jest.fn().mockRejectedValue(new Error('no network in tests')),
    post: jest.fn().mockRejectedValue(new Error('no network in tests')),
  },
}));

// socket.io-client would open a real connection on mount once authenticated.
jest.mock('socket.io-client', () => ({
  io: () => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    close: jest.fn(),
    id: 'test-socket',
  }),
}));

beforeEach(() => {
  localStorage.clear();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

test('renders the app shell without crashing', async () => {
  render(<App />);

  // AuthProvider shows a splash while it resolves, then renders the tree.
  jest.advanceTimersByTime(2000);

  await waitFor(() => {
    expect(screen.getAllByText(/FailFixes/i).length).toBeGreaterThan(0);
  });
});

test('an unauthenticated visitor lands on a public route, not a protected one', async () => {
  window.history.pushState({}, '', '/dashboard');

  render(<App />);
  jest.advanceTimersByTime(2000);

  await waitFor(() => {
    // ProtectedRoute redirects to /login when there is no user.
    expect(window.location.pathname).toBe('/login');
  });
});
