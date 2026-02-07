import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import DebugDashboard from './pages/DebugDashboard';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [useDebugDashboard, setUseDebugDashboard] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('securityToken');
    setIsAuthenticated(!!token);
    
    // Check if debug mode is enabled via URL parameter
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === 'true') {
      setUseDebugDashboard(true);
    }
  }, []);

  const DashboardComponent = useDebugDashboard ? DebugDashboard : Dashboard;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/dashboard" /> : <Login onLogin={() => setIsAuthenticated(true)} />
        } />
        <Route path="/register" element={
          isAuthenticated ? <Navigate to="/dashboard" /> : <Register onRegister={() => setIsAuthenticated(true)} />
        } />
        <Route path="/dashboard" element={
          isAuthenticated ? <DashboardComponent onLogout={() => setIsAuthenticated(false)} /> : <Navigate to="/login" />
        } />
        <Route path="/debug" element={
          isAuthenticated ? <DebugDashboard onLogout={() => setIsAuthenticated(false)} /> : <Navigate to="/login" />
        } />
        <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;