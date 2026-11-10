import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("categories")
export class Category {
  /** smallint identity (1, 2, 3 ...). Created by Sadat's CreateLookups migration. */
  @PrimaryColumn({ type: "smallint" })
  id!: number;

  @Column({ type: "varchar", length: 40, unique: true })
  name!: string;
}
