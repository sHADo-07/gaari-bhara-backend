import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AppService } from "@/src/app.service";

@ApiTags("System")
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: "API info" })
  info() {
    return this.appService.info();
  }

  @Get("health")
  @ApiOperation({ summary: "Health check (also pings the database)" })
  health() {
    return this.appService.health();
  }
}
