// === Production Configuration ===

export interface ProductionConfig {
  // Environment detection
  isProduction: boolean;
  stage: string;
  
  // Performance targets
  performance: {
    pageLoadTarget: number; // milliseconds
    apiResponseTarget: number; // milliseconds
    uptimeTarget: number; // percentage
  };
  
  // Monitoring settings
  monitoring: {
    enableDetailedMonitoring: boolean;
    enableXRayTracing: boolean;
    retentionDays: number;
  };
  
  // Security settings
  security: {
    enableWAF: boolean;
    enableCloudFront: boolean;
    corsOrigins: string[];
  };
  
  // Backup settings
  backup: {
    enablePointInTimeRecovery: boolean;
    retentionPeriod: number; // days
  };
}

export const getProductionConfig = (context?: any): ProductionConfig => {
  const env = context?.env || process.env.NODE_ENV || 'development';
  const isProduction = env === 'production';
  
  return {
    isProduction,
    stage: isProduction ? 'prod' : 'dev',
    
    performance: {
      pageLoadTarget: 3000, // 3 seconds
      apiResponseTarget: 100, // 100ms
      uptimeTarget: 99.9, // 99.9%
    },
    
    monitoring: {
      enableDetailedMonitoring: isProduction,
      enableXRayTracing: isProduction,
      retentionDays: isProduction ? 30 : 7,
    },
    
    security: {
      enableWAF: isProduction,
      enableCloudFront: true, // Always enable CloudFront for production domains
      corsOrigins: isProduction 
        ? ['https://fijian-ai.org', 'https://www.fijian-ai.org']
        : ['http://localhost:3000', 'https://fijian-ai.org'],
    },
    
    backup: {
      enablePointInTimeRecovery: isProduction,
      retentionPeriod: isProduction ? 30 : 7,
    },
  };
};

// Cache configuration
export const CACHE_CONFIG = {
  static: {
    maxAge: 31536000, // 1 year for static assets
    public: true
  },
  api: {
    vocabulary: 3600,     // 1 hour
    userProgress: 300,    // 5 minutes
    translations: 86400,  // 24 hours
    exercises: 1800      // 30 minutes
  }
};

// Security headers
export const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:",
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

// Metrics configuration
export const METRICS = {
  business: {
    activeUsers: 'COUNT',
    messagesPerDay: 'COUNT',
    averageSessionLength: 'AVERAGE',
    featureUsage: 'DISTRIBUTION'
  },
  technical: {
    apiLatency: 'PERCENTILE',
    errorRate: '4XX_5XX_COUNT',
    databaseConnections: 'GAUGE',
    memoryUsage: 'GAUGE'
  },
  user: {
    pageLoadTime: 'TIMING',
    timeToInteractive: 'TIMING',
    jsErrors: 'COUNT',
    apiFailures: 'COUNT'
  }
};