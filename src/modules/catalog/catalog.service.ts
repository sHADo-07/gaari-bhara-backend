import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Category } from "./entities/category.entity";
import { District } from "./entities/district.entity";

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(District) private readonly districts: Repository<District>,
  ) {}

  listCategories() {
    return this.categories.find({ order: { name: "ASC" } });
  }

  async listDistricts(division?: string) {
    return this.districts.find({
      where: division ? { division } : {},
      order: { name: "ASC" },
    });
  }
}
