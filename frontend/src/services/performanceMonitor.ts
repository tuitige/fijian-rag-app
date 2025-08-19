import React from 'react';

// Performance monitoring utilities for production

export interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
  url: string;
  userAgent: string;
}

export interface ApiPerformanceMetric {
  endpoint: string;
  method: string;
  duration: number;
  status: number;
  timestamp: number;
  success: boolean;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private readonly isProduction = process.env.NODE_ENV === 'production';
  
  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Track API call performance
  trackApiCall(endpoint: string, method: string, startTime: number, status: number): void {
    const duration = performance.now() - startTime;
    const metric: ApiPerformanceMetric = {
      endpoint,
      method,
      duration,
      status,
      timestamp: Date.now(),
      success: status >= 200 && status < 400,
    };

    if (this.isProduction) {
      this.sendApiMetric(metric);
    } else {
      console.log('API Performance:', metric);
    }
  }

  // Track custom performance metrics
  trackCustomMetric(name: string, value: number, metadata?: any): void {
    const metric = {
      name,
      value,
      timestamp: Date.now(),
      metadata,
    };

    if (this.isProduction) {
      this.sendCustomMetric(metric);
    } else {
      console.log('Custom Metric:', metric);
    }
  }

  // Track user interactions
  trackUserInteraction(action: string, component: string, duration?: number): void {
    const metric = {
      action,
      component,
      duration,
      timestamp: Date.now(),
      url: window.location.pathname,
    };

    if (this.isProduction) {
      this.sendUserInteraction(metric);
    } else {
      console.log('User Interaction:', metric);
    }
  }

  // Track errors
  trackError(error: Error, context?: string): void {
    const errorMetric = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    if (this.isProduction) {
      this.sendErrorMetric(errorMetric);
    } else {
      console.error('Error tracked:', errorMetric);
    }
  }

  private sendApiMetric(metric: ApiPerformanceMetric): void {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/metrics/api', JSON.stringify(metric));
    }
  }

  private sendCustomMetric(metric: any): void {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/metrics/custom', JSON.stringify(metric));
    }
  }

  private sendUserInteraction(metric: any): void {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/metrics/interaction', JSON.stringify(metric));
    }
  }

  private sendErrorMetric(metric: any): void {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/metrics/error', JSON.stringify(metric));
    }
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Higher-order component for tracking component render performance
export function withPerformanceTracking<T extends {}>(
  WrappedComponent: React.ComponentType<T>,
  componentName: string
) {
  return function PerformanceTrackedComponent(props: T) {
    const renderStart = performance.now();
    
    React.useEffect(() => {
      const renderEnd = performance.now();
      performanceMonitor.trackCustomMetric(
        'component_render_time',
        renderEnd - renderStart,
        { component: componentName }
      );
    });

    return React.createElement(WrappedComponent, props);
  };
}

// Hook for tracking API calls
export function useApiPerformance() {
  return {
    trackStart: () => performance.now(),
    trackEnd: (startTime: number, endpoint: string, method: string, status: number) => {
      performanceMonitor.trackApiCall(endpoint, method, startTime, status);
    },
  };
}

// Hook for tracking user interactions
export function useInteractionTracking() {
  return {
    trackClick: (component: string, action: string = 'click') => {
      performanceMonitor.trackUserInteraction(action, component);
    },
    trackInput: (component: string, value?: string) => {
      performanceMonitor.trackUserInteraction('input', component, value?.length);
    },
  };
}