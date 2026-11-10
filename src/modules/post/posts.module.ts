import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RolesGuard } from "@/common/guard/roles.guard";
import { AdminPostsController } from "@/modules/post/admin-posts.controller";
import { Category } from "@/modules/post/entities/category.entity";
import { District } from "@/modules/post/entities/district.entity";
import { PostImage } from "@/modules/post/entities/post-image.entity";
import { Post } from "@/modules/post/entities/post.entity";
import { PostImagesService } from "@/modules/post/post-images.service";
import { PostsController } from "@/modules/post/posts.controller";
import { PostsService } from "@/modules/post/posts.service";

@Module({
  imports: [TypeOrmModule.forFeature([Post, PostImage, Category, District])],
  controllers: [PostsController, AdminPostsController],
  providers: [PostsService, PostImagesService, RolesGuard],
  exports: [PostsService],
})
export class PostsModule {}
