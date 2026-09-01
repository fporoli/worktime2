export interface JwtPayload {
  sub: string;
  email: string;
  email_verified?: boolean;
  preferred_username?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
}
