import { StreamChunk } from '../types/llm';

export type StreamCallback = (chunk: StreamChunk) => void;
export type StreamCompleteCallback = () => void;

export class StreamingClient {
  private eventSource: EventSource | null = null;

  /**
   * Start streaming from an endpoint using Server-Sent Events
   * @param url - The streaming endpoint URL
   * @param onChunk - Callback for each received chunk
   * @param onComplete - Callback when streaming is complete
   * @param onError - Callback for errors
   */
  public startStream(
    url: string,
    onChunk: StreamCallback,
    onComplete: StreamCompleteCallback,
    onError?: (error: Error) => void
  ): void {
    this.stopStream(); // Stop any existing stream

    try {
      this.eventSource = new EventSource(url);

      this.eventSource.onmessage = (event) => {
        try {
          const chunk: StreamChunk = JSON.parse(event.data);
          onChunk(chunk);

          if (chunk.isComplete) {
            this.stopStream();
            onComplete();
          }
        } catch (parseError) {
          console.error('Error parsing stream chunk:', parseError);
          if (onError) {
            onError(new Error('Failed to parse stream data'));
          }
        }
      };

      this.eventSource.onerror = (event) => {
        console.error('Stream error:', event);
        this.stopStream();
        if (onError) {
          onError(new Error('Stream connection failed'));
        }
      };

      this.eventSource.onopen = () => {
        console.log('Stream connection opened');
      };

    } catch (error) {
      console.error('Error starting stream:', error);
      if (onError) {
        onError(error as Error);
      }
    }
  }

  /**
   * Stop the current stream
   */
  public stopStream(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /**
   * Check if currently streaming
   */
  public isStreaming(): boolean {
    return this.eventSource !== null && this.eventSource.readyState === EventSource.OPEN;
  }

  /**
   * Start streaming via POST request with request body
   * This is useful for endpoints that require POST data
   * @param url - The streaming endpoint URL
   * @param requestBody - The request payload
   * @param onChunk - Callback for each received chunk
   * @param onComplete - Callback when streaming is complete
   * @param onError - Callback for errors
   */
  public async startStreamPost(
    url: string,
    requestBody: any,
    onChunk: StreamCallback,
    onComplete: StreamCompleteCallback,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      // Get authentication token (same logic as api.ts interceptor)
      const cognitoAccessToken = localStorage.getItem('cognitoAccessToken');
      const cognitoIdToken = localStorage.getItem('cognitoIdToken');
      const legacyToken = localStorage.getItem('authToken');
      const token = cognitoAccessToken || cognitoIdToken || legacyToken;

      // Resolve full URL using the same base URL logic as api.ts
      const rawApiBaseUrl = process.env.REACT_APP_API_BASE_URL || '/api';
      
      // Smart API URL resolution: if running on production domain, use /api proxy
      const isProductionDomain = window.location.hostname === 'fijian-ai.org' || window.location.hostname === 'www.fijian-ai.org';
      const apiBaseUrl = isProductionDomain ? '/api' : 
        (rawApiBaseUrl.endsWith('/') ? rawApiBaseUrl.slice(0, -1) : rawApiBaseUrl);
      
      // Construct full URL - if url starts with '/', prepend base URL
      const fullUrl = url.startsWith('/') ? `${apiBaseUrl}${url}` : url;
      
      console.log('🚀 Streaming Request:', fullUrl);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      };

      // Add Authorization header if token is available
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available for response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            onComplete();
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.trim() === '') continue;
            
            if (line.startsWith('data: ')) {
              const data = line.slice(6); // Remove 'data: ' prefix
              
              if (data === '[DONE]') {
                onComplete();
                return;
              }

              try {
                const chunk: StreamChunk = JSON.parse(data);
                onChunk(chunk);

                if (chunk.isComplete) {
                  onComplete();
                  return;
                }
              } catch (parseError) {
                console.error('Error parsing chunk:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      console.error('Error in POST stream:', error);
      if (onError) {
        onError(error as Error);
      }
    }
  }
}