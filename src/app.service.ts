import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

@Injectable()
export class AppService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  info() {
    return { name: "Gaari Bhara API", docs: "/api", health: "/health" };
  }

  async health() {
    await this.db.query("SELECT 1");
    return { status: "ok", database: "up", timestamp: new Date().toISOString() };
  }
}
