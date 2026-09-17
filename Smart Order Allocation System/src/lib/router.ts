export type Route =
  | "/login"
  | "/orders/new"
  | "/orders"
  | "/orders/status"
  | "/admin"
  | "/admin/products"
  | "/admin/branches"
  | "/admin/users"
  | "/admin/orders"
  | "/admin/classifier";

export function getHash(): Route {
  const hash = window.location.hash.replace("#", "") || "/login";
  return hash as Route;
}

export function navigate(route: Route): void {
  window.location.hash = route;
}
