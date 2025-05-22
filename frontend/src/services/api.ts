import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle token expiry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      // Redirect to login or refresh token
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Admin API calls
export const adminApi = {
  getDashboardStats: () => api.get('/admin/stats'),
  getAffiliates: () => api.get('/admin/affiliates'),
  getProductPerformance: () => api.get('/admin/products/performance')
};

// Affiliate API calls
export const affiliateApi = {
  getDashboardStats: () => api.get('/affiliate/stats'),
  getProfile: () => api.get('/affiliate/profile'),
  updateProfile: (data: any) => api.put('/affiliate/profile', data),
  getProducts: () => api.get('/affiliate/products'),
  generateReferralLink: (productId: string) => api.post('/affiliate/referral-link', { productId })
};

// Auth API calls
export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (userData: any) => api.post('/auth/register', userData),
  me: () => api.get('/auth/me')
};

export default api;