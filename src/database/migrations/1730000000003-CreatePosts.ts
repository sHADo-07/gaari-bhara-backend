import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Owner: Arikh.  Tables: posts, post_images.
 * One feed table for both OFFER posts (owners: availability) and REQUEST posts (renters: requirement).
 * posts.rent_status is a COPY for the feed. ONLY the Rent module (Adila) changes it.
 */
export class CreatePosts1730000000003 implements MigrationInterface {
  name = "CreatePosts1730000000003";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TYPE post_type AS ENUM ('OFFER', 'REQUEST')`);
    await q.query(`CREATE TYPE post_status AS ENUM ('ACTIVE', 'CLOSED', 'HIDDEN')`);
    await q.query(`CREATE TYPE post_rent_status AS ENUM ('OPEN', 'BOOKED', 'ON_RENT')`);
    await q.query(`CREATE TYPE transmission_type AS ENUM ('AUTOMATIC', 'MANUAL')`);
    await q.query(`CREATE TYPE fuel_type AS ENUM ('PETROL', 'OCTANE', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID')`);

    await q.query(`
      CREATE TABLE posts (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        author_id     uuid NOT NULL REFERENCES users (id),
        post_type     post_type NOT NULL,
        title         varchar(120) NOT NULL,
        body          text NOT NULL,
        category_id   smallint NOT NULL REFERENCES categories (id),
        district_id   smallint NOT NULL REFERENCES districts (id),
        area_note     varchar(120),
        make          varchar(60),
        model         varchar(60),
        year          smallint,
        seats         smallint,
        transmission  transmission_type,
        fuel_type     fuel_type,
        with_driver   boolean NOT NULL DEFAULT false,
        price_per_day integer,
        date_from     date,
        date_to       date,
        status        post_status NOT NULL DEFAULT 'ACTIVE',
        rent_status   post_rent_status NOT NULL DEFAULT 'OPEN',
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT posts_title_not_empty CHECK (char_length(btrim(title)) > 0),
        CONSTRAINT posts_body_not_empty CHECK (char_length(btrim(body)) > 0),
        CONSTRAINT posts_price_not_negative CHECK (price_per_day IS NULL OR price_per_day >= 0),
        CONSTRAINT posts_dates_order CHECK (date_from IS NULL OR date_to IS NULL OR date_to >= date_from),
        CONSTRAINT posts_year_range CHECK (year IS NULL OR year BETWEEN 1950 AND 2100),
        CONSTRAINT posts_seats_range CHECK (seats IS NULL OR seats BETWEEN 1 AND 60)
      )
    `);
    await q.query(`CREATE INDEX posts_feed_idx ON posts (status, post_type, created_at DESC)`);
    await q.query(`CREATE INDEX posts_district_idx ON posts (district_id)`);
    await q.query(`CREATE INDEX posts_category_idx ON posts (category_id)`);
    await q.query(`CREATE INDEX posts_rent_status_idx ON posts (rent_status)`);
    await q.query(`CREATE INDEX posts_author_idx ON posts (author_id)`);
    await q.query(`
      CREATE TRIGGER posts_set_updated_at BEFORE UPDATE ON posts
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);

    await q.query(`
      CREATE TABLE post_images (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id    uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
        file_path  text NOT NULL,
        position   smallint NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX post_images_post_idx ON post_images (post_id, position)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS post_images`);
    await q.query(`DROP TABLE IF EXISTS posts`);
    await q.query(`DROP TYPE IF EXISTS fuel_type`);
    await q.query(`DROP TYPE IF EXISTS transmission_type`);
    await q.query(`DROP TYPE IF EXISTS post_rent_status`);
    await q.query(`DROP TYPE IF EXISTS post_status`);
    await q.query(`DROP TYPE IF EXISTS post_type`);
  }
}
