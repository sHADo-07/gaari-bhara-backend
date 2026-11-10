import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("districts")
export class District {
  @PrimaryGeneratedColumn("increment", { type: "smallint" })
  id!: number;

  @Column({ type: "varchar", length: 60, unique: true })
  name!: string;

  @Column({ type: "varchar", length: 40 })
  division!: string;
}
