import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository, SelectQueryBuilder } from "typeorm";
import { Role } from "@/common/enums/role.enum";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { Category } from "@/modules/post/entities/category.entity";
import { District } from "@/modules/post/entities/district.entity";
import { CreatePostDto } from "@/modules/post/dto/create-post.dto";
import { UpdatePostDto } from "@/modules/post/dto/update-post.dto";
import {
  AdminPostsQueryDto,
  FeedQueryDto,
  MyPostsQueryDto,
} from "@/modules/post/dto/feed-query.dto";
import { PostImage } from "@/modules/post/entities/post-image.entity";
import { Post } from "@/modules/post/entities/post.entity";
import {
  IMAGE_URL_PREFIX,
  PostRentStatus,
  PostStatus,
  PostType,
} from "@/modules/post/posts.constants";
import { toSearchPatterns } from "@/modules/post/utils/search-terms";

type Author = { id: string; fullName: string; role: string };

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    @InjectRepository(PostImage) private readonly images: Repository<PostImage>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(District) private readonly districts: Repository<District>,
    private readonly dataSource: DataSource,
  ) {}

  // ───────────────────────── create ─────────────────────────

  async create(user: AuthUser, dto: CreatePostDto) {
    this.assertCanCreateType(user, dto.postType);
    this.assertDateOrder(dto.dateFrom, dto.dateTo);
    await this.assertReferencesExist(dto.categoryId, dto.districtId);

    const saved = await this.posts.save(
      this.posts.create({
        authorId: user.id,
        postType: dto.postType,
        title: dto.title,
        body: dto.body,
        categoryId: dto.categoryId,
        districtId: dto.districtId,
        areaNote: dto.areaNote ?? null,
        make: dto.make ?? null,
        model: dto.model ?? null,
        year: dto.year ?? null,
        seats: dto.seats ?? null,
        transmission: dto.transmission ?? null,
        fuel: dto.fuel ?? null,
        withDriver: dto.withDriver ?? false,
        pricePerDay: dto.pricePerDay ?? null,
        dateFrom: dto.dateFrom ?? null,
        dateTo: dto.dateTo ?? null,
        status: PostStatus.ACTIVE,
        rentStatus: PostRentStatus.OPEN,
      }),
    );
    return this.buildDetail(saved.id, { includePrivate: true });
  }

  // ───────────────────────── read ─────────────────────────

  /** Public. HIDDEN posts are invisible here (404). CLOSED posts can still be opened by link. */
  async getPublicOne(id: string) {
    const post = await this.posts.findOne({ where: { id }, select: { id: true, status: true } });
    if (!post || post.status === PostStatus.HIDDEN) throw new NotFoundException("Post not found");
    return this.buildDetail(id, { includePrivate: false });
  }

  /** The public feed: ACTIVE posts only, newest first, with filters and keyword search. */
  async feed(query: FeedQueryDto) {
    if (query.dateFrom && query.dateTo && query.dateTo < query.dateFrom) {
      throw new BadRequestException("dateTo must not be before dateFrom");
    }
    if (query.minPrice !== undefined && query.maxPrice !== undefined && query.minPrice > query.maxPrice) {
      throw new BadRequestException("minPrice must not be greater than maxPrice");
    }

    const qb = this.baseListQuery().where("p.status = :active", { active: PostStatus.ACTIVE });

    if (query.type) qb.andWhere("p.post_type = :type", { type: query.type });
    if (query.categoryId) qb.andWhere("p.category_id = :cat", { cat: query.categoryId });
    if (query.districtId) qb.andWhere("p.district_id = :dist", { dist: query.districtId });
    if (query.withDriver !== undefined) qb.andWhere("p.with_driver = :wd", { wd: query.withDriver });
    if (query.rentStatus) qb.andWhere("p.rent_status = :rs", { rs: query.rentStatus });
    if (query.minPrice !== undefined) qb.andWhere("p.price_per_day >= :minP", { minP: query.minPrice });
    if (query.maxPrice !== undefined) qb.andWhere("p.price_per_day <= :maxP", { maxP: query.maxPrice });

    // Date window overlap. A post with no dates is "flexible" and always matches.
    if (query.dateFrom) {
      qb.andWhere("(p.date_to IS NULL OR p.date_to >= :dFrom)", { dFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere("(p.date_from IS NULL OR p.date_from <= :dTo)", { dTo: query.dateTo });
    }

    toSearchPatterns(query.q).forEach((pattern, i) => {
      qb.andWhere(`(p.title ILIKE :kw${i} OR p.body ILIKE :kw${i})`, { [`kw${i}`]: pattern });
    });

    const result = await this.paginate(qb, query.page, query.limit);
    const filters = {
      type: query.type,
      categoryId: query.categoryId,
      districtId: query.districtId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      withDriver: query.withDriver,
      rentStatus: query.rentStatus,
      q: query.q,
    };
    return {
      ...result,
      filters: Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined)),
      ...(result.meta.total === 0
        ? { message: "No posts match these filters. Try removing a filter or searching a nearby district." }
        : {}),
    };
  }

  /** My own posts, any status (so an author can see CLOSED and HIDDEN posts and why). */
  async mine(user: AuthUser, query: MyPostsQueryDto) {
    const qb = this.baseListQuery().where("p.author_id = :uid", { uid: user.id });
    if (query.status) qb.andWhere("p.status = :st", { st: query.status });
    return this.paginate(qb, query.page, query.limit, { includePrivate: true });
  }

  // ───────────────────────── edit / close ─────────────────────────

  async update(user: AuthUser, id: string, dto: UpdatePostDto) {
    const post = await this.getOwnPostOrFail(user, id);
    if (Object.keys(dto).length === 0) throw new BadRequestException("Nothing to update");
    this.assertEditable(post);

    const from = dto.dateFrom !== undefined ? dto.dateFrom : post.dateFrom;
    const to = dto.dateTo !== undefined ? dto.dateTo : post.dateTo;
    this.assertDateOrder(from, to);
    await this.assertReferencesExist(dto.categoryId, dto.districtId);

    // Compare-and-set: succeeds only if the post is STILL ACTIVE and OPEN, so it cannot
    // race with an admin hide or with Adila's rent confirm.
    const res = await this.posts
      .createQueryBuilder()
      .update(Post)
      .set({ ...dto })
      .where("id = :id AND author_id = :uid AND status = :st AND rent_status = :rs", {
        id,
        uid: user.id,
        st: PostStatus.ACTIVE,
        rs: PostRentStatus.OPEN,
      })
      .execute();
    if (!res.affected) this.assertEditable(await this.getOwnPostOrFail(user, id));
    if (!res.affected) throw new ConflictException("The post changed while you were editing. Reload and try again.");

    return this.buildDetail(id, { includePrivate: true });
  }

  /** Close = stop receiving new rents. Repeat-safe: closing a closed post is fine. */
  async close(user: AuthUser, id: string) {
    const post = await this.getOwnPostOrFail(user, id);
    if (post.status === PostStatus.CLOSED) return this.buildDetail(id, { includePrivate: true });
    this.assertEditable(post);

    const res = await this.posts
      .createQueryBuilder()
      .update(Post)
      .set({ status: PostStatus.CLOSED })
      .where("id = :id AND author_id = :uid AND status = :st AND rent_status = :rs", {
        id,
        uid: user.id,
        st: PostStatus.ACTIVE,
        rs: PostRentStatus.OPEN,
      })
      .execute();
    if (!res.affected) {
      const again = await this.getOwnPostOrFail(user, id);
      if (again.status !== PostStatus.CLOSED) this.assertEditable(again);
    }
    return this.buildDetail(id, { includePrivate: true });
  }

  // ───────────────────────── admin ─────────────────────────

  async adminList(query: AdminPostsQueryDto) {
    const qb = this.baseListQuery().where("1 = 1");
    if (query.status) qb.andWhere("p.status = :st", { st: query.status });
    if (query.type) qb.andWhere("p.post_type = :ty", { ty: query.type });
    return this.paginate(qb, query.page, query.limit, { includePrivate: true });
  }

  /** ACTIVE or CLOSED → HIDDEN. Remembers where it came from so unhide restores it. Repeat-safe. */
  async hide(id: string, reason?: string) {
    const rows: unknown[] = await this.dataSource.query(
      `UPDATE posts
          SET hidden_from_status = status, status = 'HIDDEN', hidden_reason = $2, updated_at = now()
        WHERE id = $1 AND status IN ('ACTIVE','CLOSED')
        RETURNING id`,
      [id, reason ?? null],
    );
    if (rows.length === 0) await this.assertExists(id); // already HIDDEN is fine, missing is 404
    return this.buildDetail(id, { includePrivate: true });
  }

  async unhide(id: string) {
    const rows: unknown[] = await this.dataSource.query(
      `UPDATE posts
          SET status = hidden_from_status, hidden_from_status = NULL, hidden_reason = NULL, updated_at = now()
        WHERE id = $1 AND status = 'HIDDEN'
        RETURNING id`,
      [id],
    );
    if (rows.length === 0) await this.assertExists(id);
    return this.buildDetail(id, { includePrivate: true });
  }

  // ───────────────────── for other modules (Adila, Arijit) ─────────────────────

  /** Raw row, any status. Rent and Chat modules use this instead of querying `posts` themselves. */
  async findByIdForModules(id: string): Promise<Post | null> {
    return this.posts.findOne({ where: { id } });
  }

  // ───────────────────────── helpers ─────────────────────────

  async getOwnPostOrFail(user: AuthUser, id: string): Promise<Post> {
    const post = await this.posts.findOne({ where: { id } });
    if (!post) throw new NotFoundException("Post not found");
    if (post.authorId !== user.id) throw new ForbiddenException("You can only change your own posts");
    return post;
  }

  private async assertExists(id: string) {
    const exists = await this.posts.exist({ where: { id } });
    if (!exists) throw new NotFoundException("Post not found");
  }

  private assertCanCreateType(user: AuthUser, type: PostType) {
    if (type === PostType.OFFER && user.role !== Role.OWNER) {
      throw new ForbiddenException("Only an Owner can create an OFFER post");
    }
    if (type === PostType.REQUEST && user.role !== Role.RENTER) {
      throw new ForbiddenException("Only a Renter can create a REQUEST post");
    }
  }

  private assertEditable(post: Post) {
    if (post.status === PostStatus.HIDDEN) {
      throw new ConflictException("This post was hidden by an admin and cannot be changed");
    }
    if (post.status === PostStatus.CLOSED) {
      throw new ConflictException("This post is closed and cannot be changed");
    }
    if (post.rentStatus !== PostRentStatus.OPEN) {
      throw new ConflictException(
        `This post has an active rent (${post.rentStatus}). It can be changed again when the rent is over.`,
      );
    }
  }

  private assertDateOrder(from?: string | null, to?: string | null) {
    if (from && to && to < from) throw new BadRequestException("dateTo must not be before dateFrom");
  }

  private async assertReferencesExist(categoryId?: number, districtId?: number) {
    if (categoryId && !(await this.categories.exist({ where: { id: categoryId } }))) {
      throw new BadRequestException("categoryId does not exist");
    }
    if (districtId && !(await this.districts.exist({ where: { id: districtId } }))) {
      throw new BadRequestException("districtId does not exist");
    }
  }

  private baseListQuery(): SelectQueryBuilder<Post> {
    return this.posts
      .createQueryBuilder("p")
      .leftJoinAndSelect("p.category", "c")
      .leftJoinAndSelect("p.district", "d")
      .orderBy("p.createdAt", "DESC")
      .addOrderBy("p.id", "DESC");
  }

  private async paginate(
    qb: SelectQueryBuilder<Post>,
    page: number,
    limit: number,
    opts: { includePrivate: boolean } = { includePrivate: false },
  ) {
    const [rows, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    const [imagesByPost, authors] = await Promise.all([
      this.loadImages(rows.map((r) => r.id)),
      this.loadAuthors(rows.map((r) => r.authorId)),
    ]);
    return {
      items: rows.map((r) => this.toResponse(r, imagesByPost.get(r.id) ?? [], authors.get(r.authorId), opts.includePrivate, true)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  private async buildDetail(id: string, opts: { includePrivate: boolean }) {
    const post = await this.posts.findOne({ where: { id }, relations: { category: true, district: true } });
    if (!post) throw new NotFoundException("Post not found");
    const [imagesByPost, authors] = await Promise.all([this.loadImages([id]), this.loadAuthors([post.authorId])]);
    return this.toResponse(post, imagesByPost.get(id) ?? [], authors.get(post.authorId), opts.includePrivate, false);
  }

  private async loadImages(postIds: string[]) {
    const map = new Map<string, PostImage[]>();
    if (postIds.length === 0) return map;
    const rows = await this.images
      .createQueryBuilder("i")
      .where("i.post_id IN (:...ids)", { ids: postIds })
      .orderBy("i.position", "ASC")
      .getMany();
    for (const r of rows) map.set(r.postId, [...(map.get(r.postId) ?? []), r]);
    return map;
  }

  /**
   * Only SAFE public author fields. Never email or phone.
   * Reads Sadat's `users` table (columns id, full_name, role). If he names them differently,
   * change this one query.
   */
  private async loadAuthors(ids: string[]) {
    const map = new Map<string, Author>();
    if (ids.length === 0) return map;
    const rows: { id: string; full_name: string; role: string }[] = await this.dataSource.query(
      `SELECT id, full_name, role FROM users WHERE id = ANY($1::uuid[])`,
      [Array.from(new Set(ids))],
    );
    for (const r of rows) map.set(r.id, { id: r.id, fullName: r.full_name, role: r.role });
    return map;
  }

  private toResponse(
    p: Post,
    imgs: PostImage[],
    author: Author | undefined,
    includePrivate: boolean,
    asSummary: boolean,
  ) {
    return {
      id: p.id,
      postType: p.postType,
      title: p.title,
      ...(asSummary ? { bodyPreview: p.body.length > 200 ? `${p.body.slice(0, 200)}…` : p.body } : { body: p.body }),
      category: p.category ? { id: p.category.id, name: p.category.name } : { id: p.categoryId },
      district: p.district
        ? { id: p.district.id, name: p.district.name, division: p.district.division }
        : { id: p.districtId },
      areaNote: p.areaNote,
      make: p.make,
      model: p.model,
      year: p.year,
      seats: p.seats,
      transmission: p.transmission,
      fuel: p.fuel,
      withDriver: p.withDriver,
      pricePerDay: p.pricePerDay, // asking price, in poisha
      dateFrom: p.dateFrom,
      dateTo: p.dateTo,
      status: p.status,
      rentStatus: p.rentStatus,
      images: imgs.map((i) => ({ id: i.id, position: i.position, url: `${IMAGE_URL_PREFIX}${i.filePath}` })),
      author: author ?? { id: p.authorId },
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      ...(includePrivate ? { hiddenReason: p.hiddenReason } : {}),
    };
  }
}
