import axios from 'axios';

// Get API URL from environment variable or use default
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// Log the API URL to help with debugging
console.log('API URL:', API_URL);

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  // Add timeout to prevent hanging requests
  timeout: 10000
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

// Handle token expiry and improve error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Improved error logging with more context
    if (error.response) {
      // Server responded with a status code outside of 2xx range
      console.error('API Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        endpoint: error.config.url
      });
    } else if (error.request) {
      // Request was made but no response was received
      console.error('No API Response:', {
        endpoint: error.config.url,
        method: error.config.method,
        baseURL: error.config.baseURL
      });
    } else {
      // Something happened in setting up the request
      console.error('API Request Error:', error.message);
    }

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