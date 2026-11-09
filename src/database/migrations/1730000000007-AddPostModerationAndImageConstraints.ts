import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPostModerationAndImageConstraints1730000000007
  implements MigrationInterface
{
  name = "AddPostModerationAndImageConstraints1730000000007";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE posts ADD COLUMN hidden_from_status post_status`);
    await q.query(`ALTER TABLE posts ADD COLUMN hidden_reason varchar(300)`);
    await q.query(`
      ALTER TABLE post_images
      ADD CONSTRAINT post_images_position_range CHECK (position BETWEEN 0 AND 4),
      ADD CONSTRAINT post_images_post_position_key UNIQUE (post_id, position)
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE post_images
      DROP CONSTRAINT post_images_post_position_key,
      DROP CONSTRAINT post_images_position_range
    `);
    await q.query(`ALTER TABLE posts DROP COLUMN hidden_reason`);
    await q.query(`ALTER TABLE posts DROP COLUMN hidden_from_status`);
  }
}
