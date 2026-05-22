export interface ErrorDetail {
  field: string;
  issue: string;
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  details?: ErrorDetail[];
  correlationId: string;
  timestamp: string;
  path?: string;
}
