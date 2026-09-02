export interface AppConfig {
  env: string;
  port: number;
  databaseUrl: string;
  databaseSchema: string;
  databaseSsl: boolean;
  keycloakIssuerUrl: string;
  keycloakInternalIssuerUrl: string;
  frontendOrigin: string;
}

export default (): { app: AppConfig } => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    databaseUrl: process.env.DATABASE_URL as string,
    databaseSchema: process.env.DATABASE_SCHEMA ?? 'app',
    databaseSsl: process.env.DATABASE_SSL === 'true',
    keycloakIssuerUrl: process.env.KEYCLOAK_ISSUER_URL as string,
    keycloakInternalIssuerUrl: process.env.KEYCLOAK_INTERNAL_ISSUER_URL ?? (process.env.KEYCLOAK_ISSUER_URL as string),
    frontendOrigin: process.env.FRONTEND_ORIGIN as string,
  },
});
