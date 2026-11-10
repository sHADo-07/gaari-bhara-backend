import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CatalogController } from "@/modules/catalog/catalog.controller";
import { CatalogService } from "@/modules/catalog/catalog.service";
import { Category } from "./entities/category.entity";
import { District } from "./entities/district.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Category, District])],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
