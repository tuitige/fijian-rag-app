import { ReportHandler } from 'web-vitals';

// Production performance monitoring
const sendToAnalytics = (metric: any) => {
  // In production, send to CloudWatch or analytics service
  if (process.env.NODE_ENV === 'production') {
    console.log('Performance metric:', metric);
    
    // Send to CloudWatch Custom Metrics (via API Gateway endpoint in production)
    if (window.navigator.sendBeacon) {
      const payload = JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
      
      // In a real implementation, this would be an API endpoint
      // that forwards metrics to CloudWatch
      window.navigator.sendBeacon('/api/metrics', payload);
    }
  } else {
    // Development logging
    console.log('Web Vital:', metric);
  }
};

// Enhanced performance tracking
const reportWebVitals = (onPerfEntry?: ReportHandler) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      // Original callback
      getCLS(onPerfEntry);
      getFID(onPerfEntry);
      getFCP(onPerfEntry);
      getLCP(onPerfEntry);
      getTTFB(onPerfEntry);
      
      // Production monitoring - also send to analytics
      getCLS(sendToAnalytics);
      getFID(sendToAnalytics);
      getFCP(sendToAnalytics);
      getLCP(sendToAnalytics);
      getTTFB(sendToAnalytics);
    });
  }
};

export default reportWebVitals;
