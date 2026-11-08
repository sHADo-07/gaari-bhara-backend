import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Logger } from "@nestjs/common";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { join } from "path";
import { AppModule } from "@/src/app.module";
import { appConfig } from "@/config/app.config";
import { configureApp, setupSwagger } from "@/src/app.setup";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Files uploaded by the Post module are served from /uploads
  app.useStaticAssets(join(process.cwd(), "uploads"), { prefix: "/uploads/" });
  app.getHttpAdapter().getInstance().set("trust proxy", true);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // Swagger UI needs 'unsafe-inline'
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "validator.swagger.io"],
          connectSrc: ["'self'"],
          // On plain http://localhost this would break Swagger, so it is only used in production.
          upgradeInsecureRequests: appConfig.env.NODE_ENV === "production" ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      // Our frontend runs on another origin and shows images from /uploads
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  app.use(cookieParser());
  app.enableCors({
    origin: appConfig.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    maxAge: 86400,
  });

  configureApp(app);
  setupSwagger(app);

  await app.listen(appConfig.env.PORT);
  new Logger("Bootstrap").log(`Gaari Bhara API running on http://localhost:${appConfig.env.PORT}  (docs: /api)`);
}
bootstrap();
