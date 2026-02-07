import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('securityToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Auth
export const login = async (email, password) => {
  const response = await api.post('/auth/login', {
    email,
    password,
    type: 'security'
  });
  if (response.data.token) {
    localStorage.setItem('securityToken', response.data.token);
    localStorage.setItem('securityData', JSON.stringify(response.data.security));
  }
  return response.data;
};

export const register = async (companyData) => {
  const response = await api.post('/auth/register/security', companyData);
  if (response.data.token) {
    localStorage.setItem('securityToken', response.data.token);
    localStorage.setItem('securityData', JSON.stringify(response.data.security_company));
  }
  return response.data;
};

export const logout = () => {
  localStorage.removeItem('securityToken');
  localStorage.removeItem('securityData');
};

// Security company endpoints
export const getProfile = async () => {
  const response = await api.get('/security/profile');
  return response.data;
};

export const updateProfile = async (data) => {
  const response = await api.put('/security/profile', data);
  return response.data;
};

export const toggleAvailability = async (isAvailable) => {
  const response = await api.patch('/security/availability', { is_available: isAvailable });
  return response.data;
};

// Alert endpoints
export const getAlerts = async (status = null) => {
  const params = status ? { status } : {};
  const response = await api.get('/security/alerts', { params });
  return response.data;
};

export const updateAlertStatus = async (alertId, status) => {
  const response = await api.patch(`/alerts/${alertId}/status`, { status });
  return response.data;
};

export default api;