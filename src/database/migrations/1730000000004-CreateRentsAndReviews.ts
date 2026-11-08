import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Owner: Adila.  Tables: rents, rent_status_history, reviews.
 *
 * rents_no_overlap is the database rule that makes double booking impossible:
 * two rents of the same post cannot have overlapping dates while they are CONFIRMED or ONGOING.
 * (A violation gives PostgreSQL error 23P01, which the error filter turns into 409 Conflict.)
 */
export class CreateRentsAndReviews1730000000004 implements MigrationInterface {
  name = "CreateRentsAndReviews1730000000004";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);
    await q.query(`
      CREATE TYPE rent_status AS ENUM
        ('PENDING', 'CONFIRMED', 'ONGOING', 'ENDED', 'DECLINED', 'CANCELLED', 'EXPIRED')
    `);

    await q.query(`
      CREATE TABLE rents (
        id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id             uuid NOT NULL REFERENCES posts (id),
        owner_id            uuid NOT NULL REFERENCES users (id),
        renter_id           uuid NOT NULL REFERENCES users (id),
        started_by          uuid NOT NULL REFERENCES users (id),
        start_date          date NOT NULL,
        end_date            date NOT NULL,
        agreed_price        integer,
        status              rent_status NOT NULL DEFAULT 'PENDING',
        owner_confirmed_at  timestamptz,
        renter_confirmed_at timestamptz,
        handed_over_at      timestamptz,
        ended_at            timestamptz,
        created_at          timestamptz NOT NULL DEFAULT now(),
        updated_at          timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT rents_different_people CHECK (owner_id <> renter_id),
        CONSTRAINT rents_started_by_is_party CHECK (started_by = owner_id OR started_by = renter_id),
        CONSTRAINT rents_dates_order CHECK (end_date >= start_date),
        CONSTRAINT rents_price_not_negative CHECK (agreed_price IS NULL OR agreed_price >= 0),
        CONSTRAINT rents_no_overlap EXCLUDE USING gist (
          post_id WITH =,
          daterange(start_date, end_date, '[]') WITH &&
        ) WHERE (status IN ('CONFIRMED', 'ONGOING'))
      )
    `);
    await q.query(`CREATE INDEX rents_post_status_idx ON rents (post_id, status)`);
    await q.query(`CREATE INDEX rents_renter_idx ON rents (renter_id)`);
    await q.query(`CREATE INDEX rents_owner_idx ON rents (owner_id)`);
    await q.query(`
      CREATE TRIGGER rents_set_updated_at BEFORE UPDATE ON rents
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);

    await q.query(`
      CREATE TABLE rent_status_history (
        id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        rent_id     uuid NOT NULL REFERENCES rents (id) ON DELETE CASCADE,
        old_status  rent_status,
        new_status  rent_status NOT NULL,
        changed_by  uuid REFERENCES users (id),
        note        text,
        created_at  timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX rent_status_history_rent_idx ON rent_status_history (rent_id, id)`);

    await q.query(`
      CREATE TABLE reviews (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        rent_id     uuid NOT NULL REFERENCES rents (id),
        author_id   uuid NOT NULL REFERENCES users (id),
        subject_id  uuid NOT NULL REFERENCES users (id),
        rating      smallint NOT NULL,
        comment     text NOT NULL,
        is_hidden   boolean NOT NULL DEFAULT false,
        created_at  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT reviews_one_per_author_per_rent UNIQUE (rent_id, author_id),
        CONSTRAINT reviews_rating_range CHECK (rating BETWEEN 1 AND 5),
        CONSTRAINT reviews_author_not_subject CHECK (author_id <> subject_id),
        CONSTRAINT reviews_comment_length CHECK (char_length(btrim(comment)) BETWEEN 1 AND 2000)
      )
    `);
    await q.query(`CREATE INDEX reviews_subject_idx ON reviews (subject_id)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS reviews`);
    await q.query(`DROP TABLE IF EXISTS rent_status_history`);
    await q.query(`DROP TABLE IF EXISTS rents`);
    await q.query(`DROP TYPE IF EXISTS rent_status`);
  }
}
