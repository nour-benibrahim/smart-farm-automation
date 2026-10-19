import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const typeOrmConfig = async (
  configService: ConfigService,
): Promise<TypeOrmModuleOptions> => {
  // Check if DATABASE_URL is provided (Railway deployment)
  const databaseUrl = configService.get('DATABASE_URL');
  
  if (databaseUrl) {
    // Use DATABASE_URL for Railway PostgreSQL deployment
    return {
      type: 'postgres',
      url: databaseUrl,
      autoLoadEntities: true,
      // Default to false in production to avoid ALTERs on existing data
      synchronize: configService.get('DB_SYNCHRONIZE', 'false') === 'true',
      cache: false,
      // Default to false; enable only when running fresh
      migrationsRun: configService.get('DB_MIGRATIONS_RUN', 'false') === 'true',
      dropSchema: false,
      logging: configService.get('LOG_LEVEL', 'error') === 'debug',
      // DB_SSL=false (default in .env) means the proxy terminates TLS; enabling
      // it is only needed when the database itself requires a TLS connection.
      ssl: configService.get('DB_SSL', 'false') === 'true'
        ? { rejectUnauthorized: false }
        : false,
      // Add retry configuration for Railway
      retryAttempts: 5,
      retryDelay: 5000,
      maxQueryExecutionTime: 30000,
      // Don't fail startup if database is not available (handled via extra options)
      // Additional PostgreSQL-specific options
      extra: {
        connectionTimeoutMillis: 30000,
        idleTimeoutMillis: 30000,
        max: 20,
      },
      // Enable migrations for PostgreSQL
      migrations: ['dist/migrations/*.js'],
      migrationsTableName: 'migrations',
    };
  }
  
  // Fallback to individual MySQL configuration (local development)
  return {
    type: 'mysql',
    host: configService.get('DB_HOST', 'localhost'),
    port: +configService.get<number>('DB_PORT', 3306),
    username: configService.get('DB_USER', 'root'),
    password: configService.get('DB_PASS', ''),
    database: configService.get('DB_NAME', 'smartfarm'),
    autoLoadEntities: true,
    synchronize: configService.get('DB_SYNCHRONIZE', 'true') === 'true',
    cache: false,
    migrationsRun: configService.get('DB_MIGRATIONS_RUN', 'false') === 'true',
    dropSchema: false,
    logging: configService.get('LOG_LEVEL', 'error') === 'debug',
    // Add retry configuration for local development
    retryAttempts: 3,
    retryDelay: 3000,
    maxQueryExecutionTime: 10000,
    connectTimeout: 10000,
    // Enable migrations for MySQL
    migrations: ['dist/migrations/*.js'],
    migrationsTableName: 'migrations',
  };
};
