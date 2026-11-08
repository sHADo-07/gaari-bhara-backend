import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { PostgresDatabaseProviderModule } from "@/providers/database/postgres/provider.module";
import { AppController } from "@/src/app.controller";
import { AppService } from "@/src/app.service";
import { appConfig } from "@/config/app.config";
import { UsersModule } from "@/modules/users/users.module";
import { AuthModule } from "@/modules/auth/auth.module";

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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
