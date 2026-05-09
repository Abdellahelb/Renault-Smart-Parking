const request = require('supertest');
const express = require('express');
const authRoutes = require('../src/routes/auth.routes');

// Mock db and logger
jest.mock('../src/config/db', () => ({
  query: jest.fn()
}));
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('Auth API', () => {
  it('should return 400 if operator_id or password is missing', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ operator_id: 'OP001' }); // missing password
    
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error', 'Operator ID and password required');
  });
});
