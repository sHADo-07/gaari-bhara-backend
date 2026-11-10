import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { memoryStorage } from "multer";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { AuthGuard } from "@/modules/auth/guards/auth.guard";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { CreatePostDto } from "@/modules/post/dto/create-post.dto";
import { FeedQueryDto, MyPostsQueryDto } from "@/modules/post/dto/feed-query.dto";
import { UpdatePostDto } from "@/modules/post/dto/update-post.dto";
import { PostImagesService } from "@/modules/post/post-images.service";
import { MAX_FILES_PER_REQUEST, MAX_IMAGE_BYTES } from "@/modules/post/posts.constants";
import { PostsService } from "@/modules/post/posts.service";

@ApiTags("Posts")
@Controller("posts")
export class PostsController {
  constructor(
    private readonly posts: PostsService,
    private readonly images: PostImagesService,
  ) {}

  // ── public ──

  @Get()
  @ApiOperation({ summary: "The feed: ACTIVE posts, newest first, with filters and keyword search (public)" })
  feed(@Query() query: FeedQueryDto) {
    return this.posts.feed(query);
  }

  // ── my posts (must stay ABOVE ":id" so "mine" is not read as an id) ──

  @Get("mine")
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "My own posts in any status (ACTIVE, CLOSED, HIDDEN)" })
  mine(@CurrentUser() user: AuthUser, @Query() query: MyPostsQueryDto) {
    return this.posts.mine(user, query);
  }

  @Get(":id")
  @ApiOperation({ summary: "One post with images and rent status (public, no contact details)" })
  getOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.posts.getPublicOne(id);
  }

  // ── private ──

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a post. Owner → OFFER, Renter → REQUEST" })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePostDto) {
    return this.posts.create(user, dto);
  }

  @Patch(":id")
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Edit my own ACTIVE post (only when it has no active rent)" })
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.posts.update(user, id, dto);
  }

  @Patch(":id/close")
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: "Close my own post (repeat-safe)" })
  close(@CurrentUser() user: AuthUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.posts.close(user, id);
  }

  @Post(":id/images")
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: { images: { type: "array", items: { type: "string", format: "binary" } } },
    },
  })
  @ApiOperation({ summary: "Upload images (JPEG/PNG/WEBP, max 5 MB each, max 5 per post)" })
  @UseInterceptors(
    FilesInterceptor("images", MAX_FILES_PER_REQUEST, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_FILES_PER_REQUEST },
    }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.images.upload(user, id, files);
  }

  @Delete(":id/images/:imageId")
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Remove one of my post's images" })
  removeImage(
    @CurrentUser() user: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("imageId", new ParseUUIDPipe()) imageId: string,
  ) {
    return this.images.remove(user, id, imageId);
  }
}
