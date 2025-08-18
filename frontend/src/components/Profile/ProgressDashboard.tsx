import React from 'react';
import { useProgress } from '../../contexts/UserProgressContext';
import StreakTracker from './StreakTracker';
import AchievementList from './AchievementList';
import './ProgressDashboard.css';

const ProgressDashboard: React.FC = () => {
  const { progress, stats, isLoading } = useProgress();

  if (isLoading) {
    return (
      <div className="progress-dashboard">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading your progress...</p>
        </div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="progress-dashboard">
        <div className="empty-state">
          <h3>Start Your Learning Journey</h3>
          <p>Begin practicing to see your progress here!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="progress-dashboard">
      <div className="dashboard-header">
        <h2>Your Learning Progress</h2>
        <p>Track your journey to Fijian fluency</p>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-section">
          <StreakTracker 
            currentStreak={progress.currentStreak}
            longestStreak={progress.longestStreak}
            lastPracticeDate={progress.lastPracticeDate}
          />
        </div>

        <div className="dashboard-section">
          <AchievementList achievements={progress.achievements} />
        </div>

        <div className="dashboard-section fluency-section">
          <h3>Fluency Meter</h3>
          <div className="fluency-meter">
            <div className="fluency-bar">
              <div 
                className="fluency-fill"
                style={{ width: `${progress.fluencyLevel}%` }}
              />
            </div>
            <div className="fluency-label">
              {progress.fluencyLevel}% Fluent
            </div>
          </div>
        </div>

        <div className="dashboard-section vocabulary-section">
          <h3>Vocabulary Mastery</h3>
          <div className="vocabulary-stats">
            <div className="vocab-count">
              <span className="vocab-number">{progress.totalWordsLearned}</span>
              <span className="vocab-label">Words Learned</span>
            </div>
            {progress.vocabularyMastery.length > 0 && (
              <div className="vocab-recent">
                <h4>Recent Words</h4>
                <div className="recent-words">
                  {progress.vocabularyMastery
                    .sort((a, b) => new Date(b.lastPracticed).getTime() - new Date(a.lastPracticed).getTime())
                    .slice(0, 5)
                    .map((word, index) => (
                      <div key={index} className="recent-word">
                        <span className="word-fijian">{word.word}</span>
                        <span className="word-translation">{word.translation}</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        </div>

        {stats && (
          <div className="dashboard-section stats-section">
            <h3>Practice Statistics</h3>
            <div className="practice-stats">
              <div className="stat-item">
                <span className="stat-value">{stats.weekly.practiceMinutes}</span>
                <span className="stat-label">Minutes This Week</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.weekly.messagesCount}</span>
                <span className="stat-label">Messages This Week</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.monthly.wordsLearned}</span>
                <span className="stat-label">Words This Month</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressDashboard;