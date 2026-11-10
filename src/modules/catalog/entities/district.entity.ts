import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("districts")
export class District {
  /** smallint identity (1, 2, 3 ...). Created by Sadat's CreateLookups migration. */
  @PrimaryColumn({ type: "smallint" })
  id!: number;

  @Column({ type: "varchar", length: 60, unique: true })
  name!: string;

  @Column({ type: "varchar", length: 40 })
  division!: string;
}
