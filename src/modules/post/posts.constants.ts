import { join } from "path";

export enum PostType {
  OFFER = "OFFER",
  REQUEST = "REQUEST",
}
export enum PostStatus {
  ACTIVE = "ACTIVE",
  CLOSED = "CLOSED",
  HIDDEN = "HIDDEN",
}
/** Copy of the rent state shown in the feed. ONLY the Rent module (Adila) changes it. */
export enum PostRentStatus {
  OPEN = "OPEN",
  BOOKED = "BOOKED",
  ON_RENT = "ON_RENT",
}
export enum Transmission {
  MANUAL = "MANUAL",
  AUTOMATIC = "AUTOMATIC",
}
export enum Fuel {
  PETROL = "PETROL",
  DIESEL = "DIESEL",
  OCTANE = "OCTANE",
  CNG = "CNG",
  HYBRID = "HYBRID",
  ELECTRIC = "ELECTRIC",
}

export const MAX_IMAGES_PER_POST = 5;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB each
export const MAX_FILES_PER_REQUEST = 10; // we still reject >5 with a clear message
export const UPLOAD_ROOT = join(process.cwd(), "uploads"); // same folder main.ts serves at /uploads
export const IMAGE_URL_PREFIX = "/uploads/";

// Column sizes in the posts table: title varchar(120), area_note varchar(120).
export const MAX_TITLE_LENGTH = 120;
export const MAX_AREA_NOTE_LENGTH = 120;

export const MAX_PRICE_PER_DAY_POISHA = 100_000_000; // 10 lakh taka per day
export const FEED_DEFAULT_LIMIT = 20;
export const FEED_MAX_LIMIT = 50;
