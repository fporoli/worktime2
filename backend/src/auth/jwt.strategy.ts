import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    // These differ in Docker: Keycloak stamps tokens with its public-facing KC_HOSTNAME
    // (issuerUrl), but the backend must reach Keycloak over the internal Docker network
    // to fetch signing keys (internalIssuerUrl) — same realm, two different URLs.
    const issuerUrl = configService.get<string>('app.keycloakIssuerUrl') as string;
    const internalIssuerUrl = configService.get<string>('app.keycloakInternalIssuerUrl') as string;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      issuer: issuerUrl,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${internalIssuerUrl}/protocol/openid-connect/certs`,
      }),
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
