import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Category } from "@/modules/post/entities/category.entity";
import { District } from "@/modules/post/entities/district.entity";

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(District) private readonly districts: Repository<District>,
  ) {}

  listCategories() {
    return this.categories.find({ order: { name: "ASC" } });
  }

  listDistricts(division?: string) {
    return this.districts.find({ where: division ? { division } : {}, order: { name: "ASC" } });
  }
}
