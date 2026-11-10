import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Category } from "@/modules/post/entities/category.entity";
import { District } from "@/modules/post/entities/district.entity";
import {
  Fuel,
  PostRentStatus,
  PostStatus,
  PostType,
  Transmission,
} from "@/modules/post/posts.constants";

@Entity("posts")
export class Post {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "author_id", type: "uuid" })
  authorId!: string;

  @Column({ name: "post_type", type: "enum", enum: PostType, enumName: "post_type" })
  postType!: PostType;

  @Column({ type: "varchar", length: 120 })
  title!: string;

  @Column({ type: "text" })
  body!: string;

  @Column({ name: "category_id", type: "smallint" })
  categoryId!: number;

  @ManyToOne(() => Category, { eager: false })
  @JoinColumn({ name: "category_id" })
  category?: Category;

  @Column({ name: "district_id", type: "smallint" })
  districtId!: number;

  @ManyToOne(() => District, { eager: false })
  @JoinColumn({ name: "district_id" })
  district?: District;

  @Column({ name: "area_note", type: "varchar", length: 120, nullable: true })
  areaNote!: string | null;

  @Column({ type: "varchar", length: 60, nullable: true })
  make!: string | null;

  @Column({ type: "varchar", length: 60, nullable: true })
  model!: string | null;

  @Column({ type: "smallint", nullable: true })
  year!: number | null;

  @Column({ type: "smallint", nullable: true })
  seats!: number | null;

  @Column({ type: "enum", enum: Transmission, enumName: "transmission_type", nullable: true })
  transmission!: Transmission | null;

  /** API field is "fuel"; the column in the database is fuel_type. */
  @Column({ name: "fuel_type", type: "enum", enum: Fuel, enumName: "fuel_type", nullable: true })
  fuel!: Fuel | null;

  @Column({ name: "with_driver", type: "boolean", default: false })
  withDriver!: boolean;

  /** Asking price per day in poisha (1 taka = 100 poisha). Can be negotiated in chat. */
  @Column({ name: "price_per_day", type: "integer", nullable: true })
  pricePerDay!: number | null;

  /** Calendar dates (YYYY-MM-DD) as strings, so no time-zone shifting. */
  @Column({ name: "date_from", type: "date", nullable: true })
  dateFrom!: string | null;

  @Column({ name: "date_to", type: "date", nullable: true })
  dateTo!: string | null;

  @Column({ type: "enum", enum: PostStatus, enumName: "post_status", default: PostStatus.ACTIVE })
  status!: PostStatus;

  @Column({
    name: "rent_status",
    type: "enum",
    enum: PostRentStatus,
    enumName: "post_rent_status",
    default: PostRentStatus.OPEN,
  })
  rentStatus!: PostRentStatus;

  @Column({ name: "hidden_from_status", type: "enum", enum: PostStatus, enumName: "post_status", nullable: true })
  hiddenFromStatus!: PostStatus | null;

  @Column({ name: "hidden_reason", type: "varchar", length: 300, nullable: true })
  hiddenReason!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
