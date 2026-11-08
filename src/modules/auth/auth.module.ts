import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { appConfig } from "@/config/app.config";
import { UsersModule } from "@/modules/users/users.module";
import { RevokedToken } from "@/modules/auth/entities/revoked-token.entity";
import { AuthController } from "@/modules/auth/auth.controller";
import { AuthService } from "@/modules/auth/auth.service";
import { PasswordService } from "@/modules/auth/password.service";
import { RevokedTokensService } from "@/modules/auth/revoked-tokens.service";
import { AuthGuard } from "@/modules/auth/guards/auth.guard";

/**
 * GLOBAL: every module can use  @UseGuards(AuthGuard)  without importing anything.
 * It also makes UsersService available everywhere.
 */
@Global()
@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([RevokedToken]),
    JwtModule.register({
      secret: appConfig.env.JWT_BEARER_SECRET,
      signOptions: { expiresIn: appConfig.env.JWT_TTL },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, RevokedTokensService, AuthGuard],
  exports: [AuthService, AuthGuard, JwtModule, UsersModule],
})
export class AuthModule {}
