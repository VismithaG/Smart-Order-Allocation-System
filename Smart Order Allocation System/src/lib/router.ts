export type Route =
  | "/login"
  | "/orders/new"
  | "/orders"
  | "/orders/status"
  | "/admin"
  | "/admin/branches"
  | "/admin/orders"
  | "/admin/classifier";

export function getHash(): Route {
  const hash = window.location.hash.replace("#", "") || "/login";
  return hash as Route;
}

export function navigate(route: Route): void {
  window.location.hash = route;
}
