import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";
import { User, UserStatus } from "@/modules/users/entities/user.entity";
import { Role } from "@/common/enums/role.enum";
import { UpdateProfileDto } from "@/modules/users/dto/update-profile.dto";
import { ListUsersQueryDto } from "@/modules/users/dto/list-users-query.dto";

/** What a signed-in user sees about THEMSELVES. */
export interface OwnProfile {
  id: string;
  role: Role;
  fullName: string;
  email: string;
  phone: string;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** What an ADMIN sees in the user list (own profile + the suspend reason). */
export interface AdminUserView extends OwnProfile {
  suspendedReason: string | null;
}

/** What OTHER users may see. Phone and email are never part of this (see the contact rule). */
export interface PublicUser {
  id: string;
  fullName: string;
  role: Role;
}

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  findById(id: string) {
    return this.users.findOne({ where: { id } });
  }

  findByEmail(email: string) {
    return this.users.findOne({ where: { email: email.toLowerCase() } });
  }

  /** Includes passwordHash (it is hidden by default). Use only for login and password change. */
  findByEmailWithPassword(email: string) {
    return this.users
      .createQueryBuilder("u")
      .addSelect("u.passwordHash")
      .where("u.email = :email", { email: email.toLowerCase() })
      .getOne();
  }

  findByIdWithPassword(id: string) {
    return this.users
      .createQueryBuilder("u")
      .addSelect("u.passwordHash")
      .where("u.id = :id", { id })
      .getOne();
  }

  async create(data: {
    role: Role;
    fullName: string;
    email: string;
    phone: string;
    passwordHash: string;
  }) {
    const email = await this.users.exist({ where: { email: data.email } });
    if (email) throw new ConflictException("This email is already registered");
    const phone = await this.users.exist({ where: { phone: data.phone } });
    if (phone) throw new ConflictException("This phone number is already registered");
    // Returns the entity (AuthService needs tokenVersion). Always map it with toOwnProfile() before sending.
    return this.users.save(this.users.create(data));
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const user = await this.mustFind(id);
    if (dto.phone && dto.phone !== user.phone) {
      const used = await this.users.exist({ where: { phone: dto.phone } });
      if (used) throw new ConflictException("This phone number is already registered");
      user.phone = dto.phone;
    }
    if (dto.fullName) user.fullName = dto.fullName;
    return this.toOwnProfile(await this.users.save(user));
  }

  async setPassword(id: string, passwordHash: string) {
    await this.users
      .createQueryBuilder()
      .update(User)
      .set({ passwordHash, passwordChangedAt: () => "now()", tokenVersion: () => "token_version + 1" })
      .where("id = :id", { id })
      .execute();
  }

  async markLogin(id: string) {
    await this.users.update(id, { lastLoginAt: new Date() });
  }

  // ---------------- admin ----------------

  async list(q: ListUsersQueryDto) {
    const where: any[] = [];
    const base: any = {};
    if (q.role) base.role = q.role;
    if (q.status) base.status = q.status;
    if (q.q) {
      const like = ILike(`%${q.q.replace(/[%_\\]/g, "\\$&")}%`);
      where.push({ ...base, fullName: like }, { ...base, email: like }, { ...base, phone: like });
    } else where.push(base);

    const [items, total] = await this.users.findAndCount({
      where,
      order: { createdAt: "DESC" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    });
    return {
      items: items.map((u) => this.toAdminView(u)),
      meta: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) },
    };
  }

  async suspend(adminId: string, targetId: string, reason?: string) {
    if (adminId === targetId) throw new BadRequestException("You cannot suspend yourself");
    const user = await this.mustFind(targetId);
    if (user.role === Role.ADMIN) throw new ForbiddenException("Admin accounts cannot be suspended here");
    user.status = UserStatus.SUSPENDED;
    user.suspendedReason = reason ?? null;
    return this.toAdminView(await this.users.save(user));
  }

  async restore(targetId: string) {
    const user = await this.mustFind(targetId);
    user.status = UserStatus.ACTIVE;
    user.suspendedReason = null;
    return this.toAdminView(await this.users.save(user));
  }

  // ---------------- helpers for ALL modules ----------------

  /** Use this when you show a user inside a post, review or chat. */
  toPublic(user: Pick<User, "id" | "fullName" | "role">): PublicUser {
    return { id: user.id, fullName: user.fullName, role: user.role };
  }

  /** Explicit list of fields: new columns are NEVER shown by accident (no password hash, no token version). */
  toOwnProfile(user: User): OwnProfile {
    return {
      id: user.id,
      role: user.role,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  toAdminView(user: User): AdminUserView {
    return { ...this.toOwnProfile(user), suspendedReason: user.suspendedReason };
  }

  private async mustFind(id: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException("User not found");
    return user;
  }
}
