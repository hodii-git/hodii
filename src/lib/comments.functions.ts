import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { commentTextSchema } from "./community-rules";

const idSchema = z.string().min(1).max(64);
const propertyInput = z.object({ propertyId: idSchema });

export type CommentDTO = {
  id: string; parentId: string | null; text: string; createdAt: string; editedAt: string | null;
  deleted: boolean; likes: number; author: { username: string; hue: number };
};
export type MyCommentDTO = { id: string; text: string; at: string; isReply: boolean; property: { slug: string; title: string } | null };
export type CommentStats = { comments: number; replies: number; likesReceived: number };

const server = () => import("./comments.server");
/** Signed-in person from the session cookie; refuses the call otherwise. */
const requireMember = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { requireUser } = await import("./auth.server");
  const u = await requireUser();
  return next({ context: { userId: u.id } });
});
const clearCacheMw = createMiddleware({ type: "function" }).server(async ({ next }) => { const r = await next(); (await server()).clearDiscussionCache(); return r; });

/** Public: the comments on one listing, text decrypted on the server. */
export const getComments = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => propertyInput.parse(d))
  .handler(async ({ data }) => (await server()).cachedDiscussion(data.propertyId));

/** The signed-in person's own comments and likes on one listing. */
export const getMyCommentState = createServerFn({ method: "GET" })
  .middleware([requireMember])
  .inputValidator((d: unknown) => propertyInput.parse(d))
  .handler(async ({ data, context }) => (await server()).myState(context.userId, data.propertyId));

export const addComment = createServerFn({ method: "POST" }).middleware([clearCacheMw, requireMember])
  .inputValidator((d: unknown) => propertyInput.extend({ text: commentTextSchema, parentId: idSchema.nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    await (await import("./admin.server")).assertEnabled("comments_enabled");
    return (await server()).post(context.userId, data.propertyId, data.text, data.parentId);
  });

export const editComment = createServerFn({ method: "POST" }).middleware([clearCacheMw, requireMember])
  .inputValidator((d: unknown) => z.object({ commentId: idSchema, text: commentTextSchema }).parse(d))
  .handler(async ({ data, context }) => (await server()).edit(context.userId, data.commentId, data.text));

export const deleteComment = createServerFn({ method: "POST" }).middleware([clearCacheMw, requireMember])
  .inputValidator((d: unknown) => z.object({ commentId: idSchema }).parse(d))
  .handler(async ({ data, context }) => (await server()).remove(context.userId, data.commentId));

export const toggleCommentLike = createServerFn({ method: "POST" }).middleware([clearCacheMw, requireMember])
  .inputValidator((d: unknown) => z.object({ commentId: idSchema }).parse(d))
  .handler(async ({ data, context }) => (await server()).toggleLike(context.userId, data.commentId));

/** The person's own comments, newest first, for their account page. */
export const getMyComments = createServerFn({ method: "GET" })
  .middleware([requireMember])
  .handler(async ({ context }) => (await server()).myComments(context.userId));
