import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { getAlerts, updateAlertStatus, toggleAvailability, logout } from '../services/api';
import './Dashboard.css';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in react-leaflet
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

export default function Dashboard({ onLogout }) {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [isAvailable, setIsAvailable] = useState(true);
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    loadCompanyInfo();
    loadAlerts();
    
    // Poll for new alerts every 10 seconds
    const interval = setInterval(loadAlerts, 10000);
    return () => clearInterval(interval);
  }, [filter]);

  const loadCompanyInfo = () => {
    const data = localStorage.getItem('securityData');
    if (data) {
      const company = JSON.parse(data);
      setCompanyName(company.company_name);
      setIsAvailable(company.is_available !== false);
    }
  };

  const loadAlerts = async () => {
    try {
      setError(null);
      const data = await getAlerts(filter);
      setAlerts(data);
      
      // Auto-select first pending alert
      if (filter === 'pending' && data.length > 0 && !selectedAlert) {
        setSelectedAlert(data[0]);
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
      setError('Failed to load alerts. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleDispatch = async (alertId) => {
    try {
      await updateAlertStatus(alertId, 'dispatched');
      await loadAlerts();
      if (selectedAlert?.id === alertId) {
        setSelectedAlert(null);
      }
      alert('Alert marked as dispatched!');
    } catch (error) {
      console.error('Error dispatching alert:', error);
      alert('Failed to update alert status');
    }
  };

  const handleResolve = async (alertId) => {
    try {
      await updateAlertStatus(alertId, 'resolved');
      await loadAlerts();
      if (selectedAlert?.id === alertId) {
        setSelectedAlert(null);
      }
      alert('Alert resolved successfully!');
    } catch (error) {
      console.error('Error resolving alert:', error);
      alert('Failed to update alert status');
    }
  };

  const handleAvailabilityToggle = async () => {
    try {
      await toggleAvailability(!isAvailable);
      setIsAvailable(!isAvailable);
    } catch (error) {
      console.error('Error toggling availability:', error);
      alert('Failed to update availability');
    }
  };

  const handleLogout = async () => {
    logout();
    onLogout();
    navigate('/login');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'dispatched': return '#3b82f6';
      case 'resolved': return '#10b981';
      default: return '#6b7280';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-container">
        <div className="error-box">
          <h2>⚠️ Error</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload Page
          </button>
          <button className="btn btn-secondary" onClick={handleLogout} style={{ marginTop: '10px' }}>
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <h1>🛡️ {companyName}</h1>
          <button
            className={`availability-toggle ${isAvailable ? 'available' : 'unavailable'}`}
            onClick={handleAvailabilityToggle}
          >
            {isAvailable ? '✓ Available' : '✕ Unavailable'}
          </button>
        </div>
        <div className="header-right">
          <button className="btn-secondary" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        <aside className="alerts-sidebar">
          <div className="sidebar-header">
            <h2>Alerts</h2>
            <select
              className="filter-select"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="pending">Pending</option>
              <option value="dispatched">Dispatched</option>
              <option value="resolved">Resolved</option>
              <option value="">All</option>
            </select>
          </div>

          <div className="alerts-list">
            {alerts.length === 0 ? (
              <div className="no-alerts">
                <p>No {filter} alerts</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`alert-card ${selectedAlert?.id === alert.id ? 'selected' : ''}`}
                  onClick={() => setSelectedAlert(alert)}
                >
                  <div className="alert-card-header">
                    <span
                      className="alert-status"
                      style={{ backgroundColor: getStatusColor(alert.status) }}
                    >
                      {alert.status}
                    </span>
                    <span className="alert-time">{formatDate(alert.created_at)}</span>
                  </div>
                  <div className="alert-card-body">
                    <p className="alert-user">{alert.user_name}</p>
                    <p className="alert-phone">{alert.user_phone}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        <main className="alert-details">
          {selectedAlert ? (
            <>
              <div className="details-header">
                <h2>Alert Details</h2>
                <span
                  className="details-status"
                  style={{ backgroundColor: getStatusColor(selectedAlert.status) }}
                >
                  {selectedAlert.status.toUpperCase()}
                </span>
              </div>

              <div className="details-content">
                <div className="details-section">
                  <h3>User Information</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Name:</label>
                      <span>{selectedAlert.user_name}</span>
                    </div>
                    <div className="info-item">
                      <label>Phone:</label>
                      <a href={`tel:${selectedAlert.user_phone}`}>{selectedAlert.user_phone}</a>
                    </div>
                    <div className="info-item">
                      <label>Location:</label>
                      <span>
                        {selectedAlert.latitude.toFixed(6)}, {selectedAlert.longitude.toFixed(6)}
                      </span>
                    </div>
                    <div className="info-item">
                      <label>Time:</label>
                      <span>{formatDate(selectedAlert.created_at)}</span>
                    </div>
                  </div>
                </div>

                {selectedAlert.audio_url && (
                  <div className="details-section">
                    <h3>Voice Recording</h3>
                    <audio controls className="audio-player">
                      <source src={selectedAlert.audio_url} type="audio/m4a" />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}

                <div className="details-section">
                  <h3>Location Map</h3>
                  <div className="map-container">
                    <MapContainer
                      center={[selectedAlert.latitude, selectedAlert.longitude]}
                      zoom={15}
                      style={{ height: '100%', width: '100%' }}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      />
                      <Marker position={[selectedAlert.latitude, selectedAlert.longitude]}>
                        <Popup>
                          <strong>{selectedAlert.user_name}</strong><br />
                          {selectedAlert.user_phone}
                        </Popup>
                      </Marker>
                    </MapContainer>
                  </div>
                </div>

                <div className="details-actions">
                  {selectedAlert.status === 'pending' && (
                    <button
                      className="btn btn-dispatch"
                      onClick={() => handleDispatch(selectedAlert.id)}
                    >
                      🚓 Dispatch Unit
                    </button>
                  )}
                  {selectedAlert.status === 'dispatched' && (
                    <button
                      className="btn btn-resolve"
                      onClick={() => handleResolve(selectedAlert.id)}
                    >
                      ✓ Mark as Resolved
                    </button>
                  )}
                  <a
                    href={`tel:${selectedAlert.user_phone}`}
                    className="btn btn-call"
                  >
                    📞 Call {selectedAlert.user_name}
                  </a>
                </div>
              </div>
            </>
          ) : (
            <div className="no-selection">
              <h2>No Alert Selected</h2>
              <p>Select an alert from the sidebar to view details</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}