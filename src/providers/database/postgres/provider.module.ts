import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { dataSourceOptions } from "@/config/database.config";

/**
 * Base TypeORM (PostgreSQL) connection.
 *
 * RULE FOR EVERY MODULE: register your entities in your own module with
 *   TypeOrmModule.forFeature([MyEntity])
 * They are then loaded automatically (autoLoadEntities).
 * The schema is created only by migrations (synchronize is always false).
 */
@Module({
  imports: [
    TypeOrmModule.forRoot({
      ...dataSourceOptions,
      entities: [],
      autoLoadEntities: true,
    }),
  ],
})
export class PostgresDatabaseProviderModule {}
