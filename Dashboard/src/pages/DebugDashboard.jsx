import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../services/api';

/**
 * DEBUG DASHBOARD
 * Use this simplified version to test if the dashboard loads at all
 * This helps identify if the issue is with the Dashboard component or API
 */

export default function DebugDashboard({ onLogout }) {
  const navigate = useNavigate();
  const [debugInfo, setDebugInfo] = useState({});
  const [testResults, setTestResults] = useState([]);

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = () => {
    const info = {
      timestamp: new Date().toISOString(),
      apiUrl: import.meta.env.VITE_API_URL,
      token: localStorage.getItem('securityToken') ? 'Present' : 'Missing',
      companyData: localStorage.getItem('securityData') ? 'Present' : 'Missing',
      userAgent: navigator.userAgent,
    };
    
    setDebugInfo(info);
    addTestResult('✅ Dashboard component loaded successfully');
  };

  const addTestResult = (message) => {
    setTestResults(prev => [...prev, { time: new Date().toISOString(), message }]);
  };

  const testBackendHealth = async () => {
    try {
      addTestResult('🔄 Testing backend health...');
      const baseUrl = import.meta.env.VITE_API_URL.replace('/api', '');
      const response = await fetch(`${baseUrl}/health`);
      const data = await response.json();
      addTestResult('✅ Backend health check passed: ' + JSON.stringify(data));
    } catch (error) {
      addTestResult('❌ Backend health check failed: ' + error.message);
    }
  };

  const testAlertsAPI = async () => {
    try {
      addTestResult('🔄 Testing alerts API...');
      const token = localStorage.getItem('securityToken');
      
      if (!token) {
        addTestResult('❌ No token found in localStorage');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/security/alerts`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        addTestResult(`❌ Alerts API failed: ${response.status} ${response.statusText}`);
        const text = await response.text();
        addTestResult(`Response: ${text}`);
        return;
      }

      const data = await response.json();
      addTestResult('✅ Alerts API success: ' + data.length + ' alerts found');
    } catch (error) {
      addTestResult('❌ Alerts API error: ' + error.message);
    }
  };

  const handleLogout = () => {
    logout();
    onLogout();
    navigate('/login');
  };

  return (
    <div style={{
      padding: '20px',
      fontFamily: 'monospace',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      <div style={{
        background: '#1f2937',
        color: 'white',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h1>🔧 Debug Dashboard</h1>
        <p>This is a diagnostic version to test if the dashboard is working</p>
        <button
          onClick={handleLogout}
          style={{
            padding: '10px 20px',
            background: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '10px'
          }}
        >
          Logout
        </button>
      </div>

      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2>📊 System Information</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {Object.entries(debugInfo).map(([key, value]) => (
              <tr key={key} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '10px', fontWeight: 'bold' }}>{key}</td>
                <td style={{ padding: '10px', wordBreak: 'break-all' }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2>🧪 API Tests</h2>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={testBackendHealth}
            style={{
              padding: '10px 20px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Test Backend Health
          </button>
          <button
            onClick={testAlertsAPI}
            style={{
              padding: '10px 20px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Test Alerts API
          </button>
        </div>

        <div style={{
          background: '#f3f4f6',
          padding: '15px',
          borderRadius: '4px',
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          <h3>Test Results:</h3>
          {testResults.length === 0 ? (
            <p>Click the buttons above to run tests</p>
          ) : (
            testResults.map((result, index) => (
              <div key={index} style={{
                padding: '8px',
                marginBottom: '5px',
                background: 'white',
                borderRadius: '4px',
                fontSize: '12px'
              }}>
                <span style={{ color: '#6b7280' }}>{result.time}</span>
                <br />
                {result.message}
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{
        background: '#fef2f2',
        padding: '20px',
        borderRadius: '8px',
        border: '1px solid #fecaca'
      }}>
        <h2>📝 Instructions</h2>
        <ol style={{ paddingLeft: '20px' }}>
          <li>If you see this page, the Dashboard component is loading correctly</li>
          <li>Click "Test Backend Health" - it should return OK status</li>
          <li>Click "Test Alerts API" - it should return alerts or empty array</li>
          <li>If both tests pass, the real dashboard should work</li>
          <li>If tests fail, check the error messages and fix those issues first</li>
        </ol>
        
        <h3 style={{ marginTop: '20px' }}>Common Issues:</h3>
        <ul style={{ paddingLeft: '20px' }}>
          <li><strong>Backend Health Fails:</strong> Backend not running - start it with <code>npm start</code></li>
          <li><strong>Alerts API Fails (401):</strong> Token expired - logout and login again</li>
          <li><strong>Alerts API Fails (CORS):</strong> Backend CORS not configured correctly</li>
          <li><strong>No API URL shown:</strong> .env file missing or not loaded - restart with <code>npm run dev</code></li>
        </ul>
      </div>
    </div>
  );
}