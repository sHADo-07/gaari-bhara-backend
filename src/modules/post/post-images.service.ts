import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { dirname, join } from "path";
import { DataSource, QueryFailedError, Repository } from "typeorm";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { PostImage } from "@/modules/post/entities/post-image.entity";
import { Post } from "@/modules/post/entities/post.entity";
import {
  IMAGE_URL_PREFIX,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_POST,
  PostStatus,
  UPLOAD_ROOT,
} from "@/modules/post/posts.constants";
import { PostsService } from "@/modules/post/posts.service";
import { detectImageType } from "@/modules/post/utils/image-type";

@Injectable()
export class PostImagesService {
  private readonly logger = new Logger(PostImagesService.name);

  constructor(
    @InjectRepository(PostImage) private readonly images: Repository<PostImage>,
    private readonly postsService: PostsService,
    private readonly dataSource: DataSource,
  ) {}

  async upload(user: AuthUser, postId: string, files: Express.Multer.File[] | undefined) {
    const post = await this.postsService.getOwnPostOrFail(user, postId);
    if (post.status !== PostStatus.ACTIVE) {
      throw new ConflictException("Images can only be added to an ACTIVE post");
    }
    if (!files || files.length === 0) {
      throw new BadRequestException("No image files received. Send them as multipart/form-data in the field 'images'.");
    }

    // 1) Cheap early checks, before touching the disk.
    const existing = await this.images.count({ where: { postId } });
    if (existing + files.length > MAX_IMAGES_PER_POST) {
      throw new BadRequestException(
        `A post can have at most ${MAX_IMAGES_PER_POST} images (it already has ${existing}, you sent ${files.length}).`,
      );
    }
    const detected = files.map((f, i) => {
      if (f.size > MAX_IMAGE_BYTES) {
        throw new BadRequestException(`File #${i + 1} is larger than ${MAX_IMAGE_BYTES / 1024 / 1024} MB`);
      }
      const type = detectImageType(f.buffer);
      if (!type) throw new BadRequestException(`File #${i + 1} is not a JPEG, PNG or WEBP image`);
      return type;
    });

    // 2) Write files with names WE choose (never the name the user sent).
    const written: string[] = [];
    try {
      const relPaths = files.map((_, i) => `posts/${postId}/${randomUUID()}.${detected[i].ext}`);
      for (let i = 0; i < files.length; i++) {
        const abs = join(UPLOAD_ROOT, relPaths[i]);
        await fs.mkdir(dirname(abs), { recursive: true });
        await fs.writeFile(abs, files[i].buffer, { flag: "wx" });
        written.push(abs);
      }

      // 3) Authoritative check inside a transaction with the post row locked, so two
      //    uploads at the same time cannot exceed 5. The DB also enforces it (position 0..4, unique).
      const saved = await this.dataSource.transaction(async (m) => {
        const locked = await m
          .getRepository(Post)
          .createQueryBuilder("p")
          .setLock("pessimistic_write")
          .where("p.id = :id", { id: postId })
          .getOne();
        if (!locked) throw new NotFoundException("Post not found");
        if (locked.status !== PostStatus.ACTIVE) {
          throw new ConflictException("Images can only be added to an ACTIVE post");
        }
        const rows = await m.getRepository(PostImage).find({ where: { postId } });
        if (rows.length + relPaths.length > MAX_IMAGES_PER_POST) {
          throw new BadRequestException(
            `A post can have at most ${MAX_IMAGES_PER_POST} images (it already has ${rows.length}).`,
          );
        }
        const used = new Set(rows.map((r) => r.position));
        const free: number[] = [];
        for (let pos = 0; pos < MAX_IMAGES_PER_POST && free.length < relPaths.length; pos++) {
          if (!used.has(pos)) free.push(pos);
        }
        return m.getRepository(PostImage).save(
          relPaths.map((filePath, i) => m.getRepository(PostImage).create({ postId, filePath, position: free[i] })),
        );
      });

      return saved
        .sort((a, b) => a.position - b.position)
        .map((i) => ({ id: i.id, position: i.position, url: `${IMAGE_URL_PREFIX}${i.filePath}` }));
    } catch (err) {
      await Promise.all(written.map((p) => fs.rm(p, { force: true })));
      if (err instanceof QueryFailedError) {
        throw new ConflictException("Could not save the images. Please try again.");
      }
      throw err;
    }
  }

  async remove(user: AuthUser, postId: string, imageId: string) {
    await this.postsService.getOwnPostOrFail(user, postId);
    const image = await this.images.findOne({ where: { id: imageId, postId } });
    if (!image) throw new NotFoundException("Image not found");
    await this.images.delete({ id: image.id });
    await fs.rm(join(UPLOAD_ROOT, image.filePath), { force: true }).catch((e) =>
      this.logger.warn(`Could not delete file ${image.filePath}: ${e}`),
    );
    return { message: "Image removed" };
  }
}
