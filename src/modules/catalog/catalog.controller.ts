import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { CatalogService } from "@/modules/catalog/catalog.service";

/** Public lists the frontend and Swagger need to get the ids for categoryId / districtId. */
@ApiTags("Catalog")
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("categories")
  @ApiOperation({ summary: "List vehicle categories (public)" })
  categories() {
    return this.catalog.listCategories();
  }

  @Get("districts")
  @ApiQuery({ name: "division", required: false, example: "Chattogram" })
  @ApiOperation({ summary: "List the 64 districts, optionally for one division (public)" })
  districts(@Query("division") division?: string) {
    return this.catalog.listDistricts(typeof division === "string" ? division : undefined);
  }
}
