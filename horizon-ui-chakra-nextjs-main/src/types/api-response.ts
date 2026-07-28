export interface IApiResponse<T> {
  succeeded: boolean;
  message: string;
  data?: T | null;
  errors?: string[];
}
