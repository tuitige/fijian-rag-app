import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProgress } from '../../contexts/UserProgressContext';
import ProgressDashboard from './ProgressDashboard';
import './UserProfile.css';

const UserProfile: React.FC = () => {
  const { user, logout } = useAuth();
  const { progress } = useProgress();

  if (!user) {
    return null;
  }

  return (
    <div className="user-profile">
      <div className="profile-header">
        <div className="profile-info">
          <div className="profile-avatar">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div className="profile-details">
            <h1 className="profile-name">{user.username}</h1>
            <p className="profile-email">{user.email}</p>
            <p className="profile-joined">
              Member since {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="profile-actions">
          <button 
            onClick={logout}
            className="btn btn-secondary"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="profile-content">
        <div className="profile-stats">
          {progress && (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{progress.totalWordsLearned}</div>
                <div className="stat-label">Words Learned</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{Math.round(progress.totalPracticeMinutes)}</div>
                <div className="stat-label">Minutes Practiced</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{progress.currentStreak}</div>
                <div className="stat-label">Day Streak</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{progress.fluencyLevel}%</div>
                <div className="stat-label">Fluency Level</div>
              </div>
            </div>
          )}
        </div>

        <ProgressDashboard />
      </div>
    </div>
  );
};

export default UserProfile;