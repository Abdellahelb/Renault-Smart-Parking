const isProd = import.meta.env.PROD;
const BASE_URL = import.meta.env.VITE_API_URL || (isProd ? '' : 'http://localhost:3001');

export const API_URL = `${BASE_URL}/api/v1`;
export const SOCKET_URL = BASE_URL;

export default {
    API_URL,
    SOCKET_URL
};
