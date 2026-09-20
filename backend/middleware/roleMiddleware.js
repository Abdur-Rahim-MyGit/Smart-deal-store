import { forbidden, unauthorized } from "../utils/http.js";

/** Allow only the given roles, e.g. authorize("Vendor", "Admin"). */
export const authorize =
  (...allowedRoles) =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!allowedRoles.includes(req.user.role)) {
      return next(forbidden(`This area is restricted to ${allowedRoles.join(" / ")} accounts`));
    }
    next();
  };

/** Reading needs view access; anything that changes data needs edit access. */
export const accessLevel = (req) => (["GET", "HEAD"].includes(req.method) ? "view" : "edit");

function deniedMessage(user, permission, level) {
  return level === "edit" && user.hasPermission(permission, "view")
    ? `Your admin role can view "${permission}" but not change it`
    : `Your admin role doesn't include "${permission}" access`;
}

/** Admin with the given console permission (super admins pass everything). */
export const requirePermission = (permission) => (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== "Admin") return next(forbidden());
  const level = accessLevel(req);
  if (!req.user.hasPermission(permission, level)) {
    return next(forbidden(deniedMessage(req.user, permission, level)));
  }
  next();
};

/** Admin with at least one of the listed permissions. */
export const requireAnyPermission = (permissions) => (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  const level = accessLevel(req);
  if (
    req.user.role !== "Admin" ||
    !permissions.some((permission) => req.user.hasPermission(permission, level))
  ) {
    return next(forbidden(level === "edit" ? "Your admin role can't change this" : undefined));
  }
  next();
};

/** Vendors pass straight through; admins need the permission. */
export const adminNeeds = (permission) => (req, _res, next) => {
  const level = accessLevel(req);
  if (req.user?.role === "Admin" && !req.user.hasPermission(permission, level)) {
    return next(forbidden(deniedMessage(req.user, permission, level)));
  }
  next();
};

export const requireSuperAdmin = (req, _res, next) => {
  if (req.user?.role !== "Admin" || !req.user.isSuperAdmin) {
    return next(forbidden("Only super administrators can manage staff accounts"));
  }
  next();
};

/** Vendors must be approved before they can sell, fulfil or withdraw. */
export const requireActiveVendor = (req, _res, next) => {
  if (req.user?.role === "Vendor" && req.user.vendorDetails?.status !== "Active") {
    return next(
      forbidden(
        req.user.vendorDetails?.status === "Suspended"
          ? "Your store is suspended. Please contact Smart Deal support."
          : "Your seller account is awaiting approval. You'll be able to do this once an administrator approves it.",
      ),
    );
  }
  next();
};
