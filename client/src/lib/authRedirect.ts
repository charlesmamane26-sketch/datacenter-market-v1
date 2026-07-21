export function unauthenticatedRedirectPath(pathname: string): "/login" | null {
  return pathname === "/login" ? null : "/login";
}
