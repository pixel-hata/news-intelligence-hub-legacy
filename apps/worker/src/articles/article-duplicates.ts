import type { PrismaClient } from '@nih/database';

export async function updateExactDuplicateGroup(
  prisma: PrismaClient,
  articleId: string,
  userId: string,
  textContentHash: string | null,
): Promise<string | null> {
  if (!textContentHash) {
    return null;
  }

  const duplicate = await prisma.article.findFirst({
    orderBy: {
      createdAt: 'asc',
    },
    where: {
      id: {
        not: articleId,
      },
      textContentHash,
      userId,
    },
  });

  if (!duplicate) {
    return null;
  }

  const groupId = duplicate.similarityGroupId ?? duplicate.id;
  await prisma.article.update({
    data: {
      similarityGroupId: groupId,
    },
    where: {
      id: duplicate.id,
    },
  });
  await prisma.article.update({
    data: {
      similarityGroupId: groupId,
    },
    where: {
      id: articleId,
    },
  });

  const groupSize = await prisma.article.count({
    where: {
      similarityGroupId: groupId,
      userId,
    },
  });

  await prisma.article.updateMany({
    data: {
      similarCount: Math.max(groupSize - 1, 0),
    },
    where: {
      similarityGroupId: groupId,
      userId,
    },
  });

  return groupId;
}
