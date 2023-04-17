import { Post } from "@prisma/client";
import { prisma } from "~/db.server";

export async function getPosts() {
  return prisma.post.findMany();
}

export async function getPost(slug: string) {
  return prisma.post.findUnique({ where: { slug } });
}

export async function createPost(
  post: Pick<Post, "title" | "slug" | "markdown">
) {
  return prisma.post.create({ data: post });
}
