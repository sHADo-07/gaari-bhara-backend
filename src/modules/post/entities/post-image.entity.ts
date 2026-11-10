import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("post_images")
export class PostImage {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "post_id", type: "uuid" })
  postId!: string;

  /** Path relative to the uploads folder, e.g. posts/<postId>/<uuid>.jpg */
  @Column({ name: "file_path", type: "text" })
  filePath!: string;

  /** 0..4. Unique per post. This is how the database enforces "at most 5". */
  @Column({ type: "smallint" })
  position!: number;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
