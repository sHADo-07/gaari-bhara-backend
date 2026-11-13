import { MigrationInterface, QueryRunner } from "typeorm";
export class AddPostModerationAndImageConstraints1730000000007 implements MigrationInterface {
  name = "AddPostModerationAndImageConstraints1730000000007";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE posts ADD COLUMN hidden_from_status post_status`);
    await q.query(`ALTER TABLE posts ADD COLUMN hidden_reason varchar(300)`);
    await q.query(`UPDATE posts SET hidden_from_status = 'ACTIVE' WHERE status = 'HIDDEN'`);
    await q.query(`
      ALTER TABLE posts ADD CONSTRAINT posts_hidden_consistent CHECK (
        (status = 'HIDDEN') = (hidden_from_status IS NOT NULL)
        AND (hidden_from_status IS NULL OR hidden_from_status IN ('ACTIVE', 'CLOSED'))
      )`);

    await q.query(`
      UPDATE post_images i SET position = n.pos
        FROM (SELECT id, (row_number() OVER (PARTITION BY post_id ORDER BY created_at, id) - 1)::smallint AS pos
                FROM post_images) n
       WHERE i.id = n.id`);
    await q.query(`ALTER TABLE post_images ADD CONSTRAINT post_images_position_range CHECK (position BETWEEN 0 AND 4)`);
    await q.query(`ALTER TABLE post_images ADD CONSTRAINT post_images_position_unique UNIQUE (post_id, position)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE post_images DROP CONSTRAINT IF EXISTS post_images_position_unique`);
    await q.query(`ALTER TABLE post_images DROP CONSTRAINT IF EXISTS post_images_position_range`);
    await q.query(`ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_hidden_consistent`);
    await q.query(`ALTER TABLE posts DROP COLUMN IF EXISTS hidden_reason`);
    await q.query(`ALTER TABLE posts DROP COLUMN IF EXISTS hidden_from_status`);
  }
}
