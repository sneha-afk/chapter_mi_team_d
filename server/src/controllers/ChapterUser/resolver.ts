import { Prisma } from '@prisma/client';
import { Arg, Ctx, Int, Mutation, Resolver } from 'type-graphql';

import { GQLCtx } from '../../common-types/gql';
import { prisma } from '../../prisma';
import { ChapterUser } from '../../graphql-types';

const UNIQUE_CONSTRAINT_FAILED_CODE = 'P2002';

@Resolver()
export class ChapterUserResolver {
  @Mutation(() => Boolean)
  async initUserInterestForChapter(
    @Arg('event_id', () => Int) event_id: number,
    @Ctx() ctx: GQLCtx,
  ): Promise<boolean> {
    if (!ctx.user) {
      throw Error('User must be logged in to update role ');
    }
    const event = await prisma.events.findUnique({
      where: { id: event_id },
      include: { chapter: true },
    });
    if (!event.chapter) {
      throw Error('Cannot find the chapter of the event with id ' + event_id);
    }

    try {
      await prisma.chapter_users.create({
        data: {
          user: { connect: { id: ctx.user.id } },
          chapter: { connect: { id: event.chapter.id } },
          chapter_role: { connect: { name: 'member' } },
          subscribed: true, // TODO use user specified setting
          joined_date: new Date(),
        },
      });
    } catch (e) {
      if (
        !(e instanceof Prisma.PrismaClientKnownRequestError) ||
        e.code !== UNIQUE_CONSTRAINT_FAILED_CODE
      ) {
        throw e;
      }
    }

    return true;
  }

  @Mutation(() => ChapterUser)
  async changeChapterUserRole(
    @Arg('chapterId', () => Int) chapterId: number,
    @Arg('roleId', () => Int) roleId: number,
    @Arg('userId', () => Int) userId: number,
    @Ctx() ctx: GQLCtx,
  ): Promise<ChapterUser> {
    if (!ctx.user) {
      throw Error('User must be logged in to change chapter role');
    }
    return await prisma.chapter_users.update({
      data: { chapter_role: { connect: { id: roleId } } },
      where: {
        user_id_chapter_id: {
          chapter_id: chapterId,
          user_id: userId,
        },
      },
      include: {
        chapter_role: {
          include: {
            chapter_role_permissions: { include: { chapter_permission: true } },
          },
        },
        user: true,
      },
    });
  }
}
