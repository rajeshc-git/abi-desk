import { type DynamicModule, Global, Module } from '@nestjs/common';
import { AppConfig } from './app-config';
import { type Env } from './env.schema';

/**
 * Global configuration module.
 *
 * Environment parsing happens once at process start (see `main.ts`) and the
 * validated result is injected here, so no module ever re-reads or re-validates
 * `process.env`.
 */
@Global()
@Module({})
export class ConfigModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: AppConfig, useFactory: () => new AppConfig(env) }],
      exports: [AppConfig],
    };
  }
}
