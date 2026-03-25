import jwt from 'jsonwebtoken';

export interface WsAuthResult {
  valid: boolean;
  userId?: string;
  companyId?: string;
  error?: string;
}

export function validateWsToken(token: string): WsAuthResult {
  try {
    // In development, we simulate token validation
    // In production, use proper secret to validate JWT
    if (process.env.NODE_ENV === 'development' || !process.env.JWT_SECRET) {
      // For dev purposes, we accept any non-empty "token" as valid
      // and return a mock auth result for testing
      if (token && token.length > 0) {
        // If token contains "||" we treat it as userId||companyId format
        if (token.includes('||')) {
          const [userId, companyId] = token.split('||');
          return { 
            valid: true, 
            userId: userId.replace(/[^a-zA-Z0-9]/g, ''), 
            companyId: companyId.replace(/[^a-zA-Z0-9]/g, '') 
          };
        }
        
        // For simple tokens, use generic IDs
        return { valid: true, userId: 'dev-user', companyId: 'dev-company' };
      }
    } else {
      // Production token validation
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as { 
        userId: string, 
        companyId: string 
      };
      
      return { 
        valid: true, 
        userId: decoded.userId, 
        companyId: decoded.companyId 
      };
    }
    
    return { valid: false, error: 'Invalid or missing token' };
  } catch (error) {
    return { valid: false, error: 'Token validation failed' };
  }
}