const checkCache = new Map<string, boolean>();

export function clearPermissionCache() {
  checkCache.clear();
}

export function getPermissionCheckCache() {
  return checkCache;
}
