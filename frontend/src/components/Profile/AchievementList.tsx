import React from 'react';
import { Achievement, ACHIEVEMENTS } from '../../types/progress';
import './AchievementList.css';

interface AchievementListProps {
  achievements: Achievement[];
}

const AchievementList: React.FC<AchievementListProps> = ({ achievements }) => {
  const unlockedAchievements = achievements.filter(a => a.unlockedAt);
  const lockedAchievements = ACHIEVEMENTS.filter(
    template => !achievements.some(a => a.id === template.id && a.unlockedAt)
  );

  return (
    <div className="achievement-list">
      <h3>🏆 Achievements</h3>
      
      <div className="achievements-summary">
        <span className="achievement-count">
          {unlockedAchievements.length} of {ACHIEVEMENTS.length} unlocked
        </span>
        <div className="achievement-progress-bar">
          <div 
            className="achievement-progress-fill"
            style={{ width: `${(unlockedAchievements.length / ACHIEVEMENTS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="achievements-grid">
        {unlockedAchievements.map((achievement) => (
          <div key={achievement.id} className="achievement-item unlocked">
            <div className="achievement-icon">{achievement.icon}</div>
            <div className="achievement-info">
              <h4 className="achievement-name">{achievement.name}</h4>
              <p className="achievement-description">{achievement.description}</p>
              {achievement.unlockedAt && (
                <span className="achievement-date">
                  Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="achievement-badge">✓</div>
          </div>
        ))}

        {lockedAchievements.map((template) => {
          const inProgress = achievements.find(a => a.id === template.id && !a.unlockedAt);
          return (
            <div key={template.id} className="achievement-item locked">
              <div className="achievement-icon locked">{template.icon}</div>
              <div className="achievement-info">
                <h4 className="achievement-name">{template.name}</h4>
                <p className="achievement-description">{template.description}</p>
                {inProgress && inProgress.progress > 0 && (
                  <div className="achievement-in-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${inProgress.progress}%` }}
                      />
                    </div>
                    <span className="progress-text">{inProgress.progress}%</span>
                  </div>
                )}
              </div>
              <div className="achievement-badge locked">🔒</div>
            </div>
          );
        })}
      </div>

      {unlockedAchievements.length === 0 && (
        <div className="no-achievements">
          <div className="no-achievements-icon">🎯</div>
          <h4>No achievements yet</h4>
          <p>Keep practicing to unlock your first achievement!</p>
        </div>
      )}
    </div>
  );
};

export default AchievementList;