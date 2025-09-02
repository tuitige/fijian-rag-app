export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  type?: string;
}

export interface ApiError {
  error: string;
  message?: string;
  type?: string;
  statusCode?: number;
  requiresReauth?: boolean;
}

export interface LearningModule {
  title: string;
  pages: number;
  summary: string;
}

export interface LearningModulesResponse {
  modules: LearningModule[];
}