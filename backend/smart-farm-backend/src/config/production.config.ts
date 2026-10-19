export const productionConfig = {
  port: 3000,
  database: {
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT) || 5432,
    username: process.env.DATABASE_USERNAME || process.env.DB_USER,
    password: process.env.DATABASE_PASSWORD || process.env.DB_PASS,
    database: process.env.DATABASE_NAME || process.env.DB_NAME,
  },
  jwt: {
    secret: (() => {
      const s = process.env.JWT_SECRET;
      if (!s) throw new Error('JWT_SECRET environment variable is required. Generate one with: openssl rand -hex 32');
      return s;
    })(),
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
  },
  mqtt: {
    brokerUrl: process.env.MQTT_BROKER,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'error',
  },
};
