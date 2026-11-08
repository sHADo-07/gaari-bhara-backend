import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { createAppValidationPipe } from "@/common/pipes/app-validation.pipe";
import { AllExceptionsFilter } from "@/common/filters/all-exceptions.filter";

/** Shared by main.ts and the e2e tests, so tests run with the SAME rules as the real app. */
export function configureApp(app: INestApplication) {
  app.useGlobalPipes(createAppValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
}

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("Gaari Bhara API")
    .setDescription("Peer-to-peer vehicle rental information platform (middleman, no payments).")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("api", app, SwaggerModule.createDocument(app, config));
}
