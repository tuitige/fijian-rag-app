import React from 'react';
import './StreakTracker.css';

interface StreakTrackerProps {
  currentStreak: number;
  longestStreak: number;
  lastPracticeDate: Date;
}

const StreakTracker: React.FC<StreakTrackerProps> = ({
  currentStreak,
  longestStreak,
  lastPracticeDate
}) => {
  const isToday = (date: Date): boolean => {
    const today = new Date();
    const checkDate = new Date(date);
    return (
      today.getDate() === checkDate.getDate() &&
      today.getMonth() === checkDate.getMonth() &&
      today.getFullYear() === checkDate.getFullYear()
    );
  };

  const isYesterday = (date: Date): boolean => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const checkDate = new Date(date);
    return (
      yesterday.getDate() === checkDate.getDate() &&
      yesterday.getMonth() === checkDate.getMonth() &&
      yesterday.getFullYear() === checkDate.getFullYear()
    );
  };

  const getStreakStatus = (): { status: string; message: string; icon: string } => {
    if (isToday(lastPracticeDate)) {
      return {
        status: 'active',
        message: 'Great! You practiced today!',
        icon: '🔥'
      };
    } else if (isYesterday(lastPracticeDate)) {
      return {
        status: 'at-risk',
        message: 'Practice today to maintain your streak!',
        icon: '⚠️'
      };
    } else {
      return {
        status: 'broken',
        message: 'Start a new streak today!',
        icon: '💪'
      };
    }
  };

  const { status, message, icon } = getStreakStatus();

  return (
    <div className="streak-tracker">
      <h3>🔥 Learning Streak</h3>
      
      <div className={`streak-display ${status}`}>
        <div className="streak-number">
          <span className="streak-value">{currentStreak}</span>
          <span className="streak-label">Day{currentStreak !== 1 ? 's' : ''}</span>
        </div>
        <div className="streak-icon">{icon}</div>
      </div>

      <div className="streak-status">
        <p className={`status-message ${status}`}>{message}</p>
      </div>

      <div className="streak-stats">
        <div className="streak-stat">
          <span className="stat-label">Longest Streak</span>
          <span className="stat-value">{longestStreak} days</span>
        </div>
        <div className="streak-stat">
          <span className="stat-label">Last Practice</span>
          <span className="stat-value">
            {isToday(lastPracticeDate) 
              ? 'Today' 
              : isYesterday(lastPracticeDate)
              ? 'Yesterday'
              : new Date(lastPracticeDate).toLocaleDateString()
            }
          </span>
        </div>
      </div>

      <div className="streak-calendar">
        <div className="calendar-header">
          <span>Recent Activity</span>
        </div>
        <div className="calendar-dots">
          {Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            const isPracticeDay = date <= new Date(lastPracticeDate) && 
              (new Date(lastPracticeDate).getTime() - date.getTime()) < (currentStreak * 24 * 60 * 60 * 1000);
            
            return (
              <div
                key={i}
                className={`calendar-dot ${isPracticeDay ? 'active' : 'inactive'}`}
                title={date.toDateString()}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StreakTracker;