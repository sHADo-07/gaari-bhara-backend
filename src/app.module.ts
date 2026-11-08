import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { PostgresDatabaseProviderModule } from "@/providers/database/postgres/provider.module";
import { AppController } from "@/src/app.controller";
import { AppService } from "@/src/app.service";
import { appConfig } from "@/config/app.config";
import { UsersModule } from "@/modules/users/users.module";
import { AuthModule } from "@/modules/auth/auth.module";
import { AuditModule } from "@/modules/audit/audit.module";
import { RequestLoggerMiddleware } from "@/common/middlewares/request-logger.middleware";
import { TimingInterceptor } from "@/common/interceptors/timing.interceptor";

/**
 * HOW TO ADD YOUR MODULE: create src/modules/<name>/, then add <Name>Module to "imports" below.
 * Sadat's modules (Auth, Users) are already here. Arikh: PostsModule. Adila: RentsModule, ReviewsModule.
 * Arijit: ChatModule.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
      skipIf: () => appConfig.env.THROTTLE_DISABLED,
    }),
    PostgresDatabaseProviderModule,
    UsersModule,
    AuthModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_INTERCEPTOR, useClass: TimingInterceptor }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes("*path");
  }
}
