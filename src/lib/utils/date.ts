export function getRelativeDateGroup(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffInTime = today.getTime() - targetDate.getTime();
  const diffInDays = Math.floor(diffInTime / (1000 * 3600 * 24));

  if (diffInDays === 0) {
    return 'Today';
  } else if (diffInDays === 1) {
    return 'Yesterday';
  } else if (diffInDays <= 7) {
    return 'This week';
  } else if (diffInDays <= 30) {
    return 'This month';
  } else {
    return 'More than a month ago';
  }
}

export function groupChatsByDate<T extends { updatedAt: Date; pinned?: boolean }>(
  chats: T[],
): Array<{ group: string; chats: T[] }> {
  // Separate pinned and unpinned chats
  const pinnedChats = chats.filter((chat) => chat.pinned).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const unpinnedChats = chats.filter((chat) => !chat.pinned);

  const groups = new Map<string, T[]>();

  // Define the order of groups
  const groupOrder = ['Today', 'Yesterday', 'This week', 'This month', 'More than a month ago'];

  // Group unpinned chats by date
  unpinnedChats.forEach((chat) => {
    const group = getRelativeDateGroup(chat.updatedAt);
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)!.push(chat);
  });

  const result: Array<{ group: string; chats: T[] }> = [];

  // Add pinned chats group first (without title)
  if (pinnedChats.length > 0) {
    result.push({
      group: '',
      chats: pinnedChats,
    });
  }

  // Add date-grouped unpinned chats
  groupOrder
    .filter((group) => groups.has(group))
    .forEach((group) => {
      result.push({
        group,
        chats: groups.get(group)!,
      });
    });

  return result;
}

export default {
  getRelativeDateGroup,
  groupChatsByDate,
};
