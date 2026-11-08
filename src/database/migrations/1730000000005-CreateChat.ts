import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Owner: Arijit.  Tables: conversations, messages, conversation_reads.
 * The two users of a conversation are saved in a fixed order (user_low_id < user_high_id),
 * so there is exactly ONE conversation for each pair of users for each post.
 */
export class CreateChat1730000000005 implements MigrationInterface {
  name = "CreateChat1730000000005";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE conversations (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_low_id     uuid NOT NULL REFERENCES users (id),
        user_high_id    uuid NOT NULL REFERENCES users (id),
        post_id         uuid NOT NULL REFERENCES posts (id),
        last_message_at timestamptz,
        created_at      timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT conversations_user_order CHECK (user_low_id < user_high_id),
        CONSTRAINT conversations_one_per_pair_per_post UNIQUE (user_low_id, user_high_id, post_id)
      )
    `);
    await q.query(`CREATE INDEX conversations_low_idx ON conversations (user_low_id, last_message_at DESC)`);
    await q.query(`CREATE INDEX conversations_high_idx ON conversations (user_high_id, last_message_at DESC)`);

    await q.query(`
      CREATE TABLE messages (
        id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        conversation_id uuid NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
        sender_id       uuid NOT NULL REFERENCES users (id),
        body            text NOT NULL,
        client_msg_id   uuid NOT NULL,
        created_at      timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT messages_body_length CHECK (char_length(body) BETWEEN 1 AND 2000),
        CONSTRAINT messages_sender_client_id_key UNIQUE (sender_id, client_msg_id)
      )
    `);
    await q.query(`CREATE INDEX messages_conversation_idx ON messages (conversation_id, id)`);

    await q.query(`
      CREATE TABLE conversation_reads (
        conversation_id      uuid NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
        user_id              uuid NOT NULL REFERENCES users (id),
        last_read_message_id bigint REFERENCES messages (id),
        updated_at           timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (conversation_id, user_id)
      )
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS conversation_reads`);
    await q.query(`DROP TABLE IF EXISTS messages`);
    await q.query(`DROP TABLE IF EXISTS conversations`);
  }
}
