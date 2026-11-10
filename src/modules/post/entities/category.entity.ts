import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("categories")
export class Category {
  @PrimaryGeneratedColumn("increment", { type: "smallint" })
  id!: number;

  @Column({ type: "varchar", length: 40, unique: true })
  name!: string;
}
