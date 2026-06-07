import { apiRequest } from './client'

export interface VerifyResponse {
  authenticated: boolean
  user_id: string
}

export function verifyAuth(): Promise<VerifyResponse> {
  return apiRequest<VerifyResponse>('/auth/verify')
}
