import { render } from '@testing-library/react';
import { describe, it, vi, expect } from 'vitest';
import ReportsPage from './ReportsPage';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  default: () => ({
    on: vi.fn(),
    off: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

// Mock useAuthStore
vi.mock('../store/authStore', () => ({
  default: () => ({
    token: 'mock-token',
  }),
}));

describe('ReportsPage', () => {
  it('renders without crashing', () => {
    render(<ReportsPage />);
  });
});
