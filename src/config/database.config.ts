import {
  DefaultNamingStrategy,
  NamingStrategyInterface,
  DataSourceOptions,
} from "typeorm";
import { camelCase, snakeCase } from "typeorm/util/StringUtils";
import * as dotenv from "dotenv";
dotenv.config({ quiet: true });

/**
 * Snake naming is used in database operations (createdAt -> created_at).
 * Tables are written explicitly with @Entity("table_name"), so only column and
 * relation naming matters here.
 */
export class SnakeNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  tableName(className: string, customName: string): string {
    return customName || snakeCase(className) + "s";
  }

  columnName(
    propertyName: string,
    customName: string,
    embeddedPrefixes: string[],
  ): string {
    const prefix = embeddedPrefixes.length ? snakeCase(embeddedPrefixes.join("_")) + "_" : "";
    return prefix + (customName || snakeCase(propertyName));
  }

  relationName(propertyName: string): string {
    return camelCase(propertyName, true);
  }

  joinColumnName(relationName: string, referencedColumnName: string): string {
    return snakeCase(`${relationName}_${referencedColumnName}`);
  }

  joinTableName(
    firstTableName: string,
    secondTableName: string,
    firstPropertyName: string,
  ): string {
    return snakeCase(
      `${firstTableName}_${firstPropertyName.replace(/\./gi, "_")}_${secondTableName}`,
    );
  }

  joinTableColumnName(tableName: string, propertyName: string, columnName?: string): string {
    return snakeCase(`${tableName}_${columnName || propertyName}`);
  }

  classTableInheritanceParentColumnName(
    parentTableName: string,
    parentTableIdPropertyName: string,
  ): string {
    return snakeCase(`${parentTableName}_${parentTableIdPropertyName}`);
  }
}

/**
 * Used by the migration scripts (they find entities and migrations by file name).
 * The running app registers entities with TypeOrmModule.forFeature([...]) instead
 * (see providers/database/postgres/provider.module.ts).
 */
export const dataSourceOptions: DataSourceOptions = {
  type: "postgres",
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : undefined,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  schema: "public",
  entities: [__dirname + "/../modules/**/entities/*.entity.{ts,js}"],
  namingStrategy: new SnakeNamingStrategy(),
  migrations: [__dirname + "/../database/migrations/*.{ts,js}"],
  logging: process.env.DB_LOGGING === "true",
  synchronize: false,
};

export default dataSourceOptions;
