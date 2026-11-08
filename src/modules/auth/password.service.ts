import { Injectable, OnModuleInit } from "@nestjs/common";
import * as argon2 from "argon2";

/** Passwords are hashed with Argon2id (a trusted, slow, salted hash). We never store or log plain passwords. */
@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash = "";

  async onModuleInit() {
    // Used to spend the same time when the email does not exist (hides which emails are registered).
    this.dummyHash = await argon2.hash("dummy-password-for-timing", { type: argon2.argon2id });
  }

  hash(plain: string) {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  async verify(hash: string | undefined, plain: string) {
    try {
      return await argon2.verify(hash ?? this.dummyHash, plain);
    } catch {
      return false;
    }
  }
}
