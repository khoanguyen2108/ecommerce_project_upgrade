import type { AuthProvider, UserRole } from '../../generated/prisma/enums';
import type { RequestWithId } from '../../common/types/request-with-id';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: UserRole;
  authProvider: AuthProvider;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticatedRequest extends RequestWithId {
  user?: AuthenticatedUser;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: 'access';
}
