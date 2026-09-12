export type UserRole = "admin" | "operator" | "user";

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  token?: string;
  user: User;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
  meta?: Record<string, any>;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
