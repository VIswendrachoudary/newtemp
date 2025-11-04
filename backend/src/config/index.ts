import dotenv from 'dotenv'
import { z } from 'zod'

// Load environment variables
dotenv.config()

// Environment schema validation
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('5000'),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // JWT
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  REFRESH_TOKEN_SECRET: z.string(),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('30d'),

  // OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  ORCID_CLIENT_ID: z.string().optional(),
  ORCID_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  // Frontend
  FRONTEND_URL: z.string().default('http://localhost:3000'),

  // File storage
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.string().transform(Number).default('9000'),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin'),
  MINIO_USE_SSL: z.string().transform(val => val === 'true').default('false'),
  MINIO_BUCKET_NAME: z.string().default('edna-files'),

  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  FROM_EMAIL: z.string().optional(),

  // BLAST
  BLAST_DB_PATH: z.string().default('./data/blast'),
  BLAST_EXEC_PATH: z.string().default('/usr/bin/blast'),
  NCBI_API_KEY: z.string().optional(),

  // File upload
  MAX_FILE_SIZE: z.string().transform(Number).default('104857600'), // 100MB
  UPLOAD_DIR: z.string().default('./uploads'),
  ALLOWED_FILE_TYPES: z.string().default('fasta,fastq,fq,fa,fas,sam,bam'),

  // Processing
  MAX_CONCURRENT_JOBS: z.string().transform(Number).default('4'),
  DEFAULT_BATCH_SIZE: z.string().transform(Number).default('100'),
  QUALITY_THRESHOLD: z.string().transform(Number).default('20'),
  MIN_SEQUENCE_LENGTH: z.string().transform(Number).default('50'),
  MAX_SEQUENCE_LENGTH: z.string().transform(Number).default('1000'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

  // Monitoring
  SENTRY_DSN: z.string().optional(),
  GOOGLE_ANALYTICS_ID: z.string().optional(),

  // Elasticsearch
  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),
  ELASTICSEARCH_INDEX_PREFIX: z.string().default('edna'),

  // ML Pipeline
  ML_PIPELINE_URL: z.string().default('http://localhost:8000'),
})

// Validate environment variables
const env = envSchema.parse(process.env)

export const config = {
  env: env.NODE_ENV,
  port: env.PORT,

  database: {
    url: env.DATABASE_URL,
  },

  redis: {
    url: env.REDIS_URL,
  },

  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshSecret: env.REFRESH_TOKEN_SECRET,
    refreshExpiresIn: env.REFRESH_TOKEN_EXPIRES_IN,
  },

  oauth: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
    orcid: {
      clientId: env.ORCID_CLIENT_ID,
      clientSecret: env.ORCID_CLIENT_SECRET,
    },
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
  },

  frontend: {
    url: env.FRONTEND_URL,
  },

  storage: {
    minio: {
      endpoint: env.MINIO_ENDPOINT,
      port: env.MINIO_PORT,
      accessKey: env.MINIO_ACCESS_KEY,
      secretKey: env.MINIO_SECRET_KEY,
      useSSL: env.MINIO_USE_SSL,
      bucketName: env.MINIO_BUCKET_NAME,
    },
  },

  email: {
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
      password: env.SMTP_PASSWORD,
      from: env.FROM_EMAIL,
    },
  },

  blast: {
    dbPath: env.BLAST_DB_PATH,
    execPath: env.BLAST_EXEC_PATH,
    ncbiApiKey: env.NCBI_API_KEY,
  },

  upload: {
    maxFileSize: env.MAX_FILE_SIZE,
    uploadDir: env.UPLOAD_DIR,
    allowedFileTypes: env.ALLOWED_FILE_TYPES.split(','),
  },

  processing: {
    maxConcurrentJobs: env.MAX_CONCURRENT_JOBS,
    defaultBatchSize: env.DEFAULT_BATCH_SIZE,
    qualityThreshold: env.QUALITY_THRESHOLD,
    minSequenceLength: env.MIN_SEQUENCE_LENGTH,
    maxSequenceLength: env.MAX_SEQUENCE_LENGTH,
  },

  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },

  monitoring: {
    sentryDsn: env.SENTRY_DSN,
    googleAnalyticsId: env.GOOGLE_ANALYTICS_ID,
  },

  elasticsearch: {
    url: env.ELASTICSEARCH_URL,
    indexPrefix: env.ELASTICSEARCH_INDEX_PREFIX,
  },

  mlPipeline: {
    url: env.ML_PIPELINE_URL,
  },
}

// Export environment variables for type safety
export type Env = z.infer<typeof envSchema>