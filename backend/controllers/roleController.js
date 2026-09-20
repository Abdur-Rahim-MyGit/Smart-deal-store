import AdminRole from "../models/AdminRole.js";
import User, { ADMIN_PERMISSIONS } from "../models/User.js";
import { asyncHandler, badRequest, conflict, isObjectId, notFound } from "../utils/http.js";
import { audit } from "../utils/notify.js";

const cleanList = (value) => [
  ...new Set(
    (Array.isArray(value) ? value : []).filter((permission) =>
      ADMIN_PERMISSIONS.includes(permission),
    ),
  ),
];

/** Edit access implies view access, so a module is never listed as both. */
export function readAccess(body) {
  const permissions = cleanList(body.permissions);
  const viewPermissions = cleanList(body.viewPermissions).filter(
    (permission) => !permissions.includes(permission),
  );
  return { permissions, viewPermissions };
}

function readRoleInput(body, { partial = false } = {}) {
  const data = {};
  if (body.name !== undefined || !partial) {
    data.name = String(body.name ?? "").trim();
    if (data.name.length < 2) throw badRequest("Give the role a name");
  }
  if (body.description !== undefined)
    data.description = String(body.description || "").trim() || undefined;
  if (body.permissions !== undefined || body.viewPermissions !== undefined || !partial) {
    Object.assign(data, readAccess(body));
  }
  return data;
}

// @route GET /api/admin/roles
export const listRoles = asyncHandler(async (_req, res) => {
  const [roles, counts] = await Promise.all([
    AdminRole.find().sort({ name: 1 }).lean(),
    User.aggregate([
      { $match: { role: "Admin", adminRole: { $ne: null } } },
      { $group: { _id: "$adminRole", count: { $sum: 1 } } },
    ]),
  ]);
  const byRole = new Map(counts.map((row) => [String(row._id), row.count]));
  res.json({
    success: true,
    roles: roles.map((role) => ({ ...role, staffCount: byRole.get(String(role._id)) || 0 })),
    permissions: ADMIN_PERMISSIONS,
  });
});

// @route POST /api/admin/roles
export const createRole = asyncHandler(async (req, res) => {
  const data = readRoleInput(req.body);
  if (await AdminRole.exists({ name: data.name })) throw conflict(`"${data.name}" already exists`);
  const role = await AdminRole.create(data);
  await audit(req, "role.create", {
    entityType: "AdminRole",
    entityId: role._id,
    summary: role.name,
  });
  res.status(201).json({ success: true, message: "Role created", role });
});

// @route PUT /api/admin/roles/:id — access changes apply to everyone on the role
export const updateRole = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw badRequest("Invalid role");
  const role = await AdminRole.findById(req.params.id);
  if (!role) throw notFound("Role not found");
  const data = readRoleInput(req.body, { partial: true });
  if (data.name && data.name !== role.name && (await AdminRole.exists({ name: data.name })))
    throw conflict(`"${data.name}" already exists`);

  role.set(data);
  await role.save();
  const updated = await User.updateMany(
    { role: "Admin", adminRole: role._id },
    { $set: { permissions: role.permissions, viewPermissions: role.viewPermissions } },
  );

  await audit(req, "role.update", {
    entityType: "AdminRole",
    entityId: role._id,
    summary: `${role.name}: edit [${role.permissions.join(", ")}], view [${role.viewPermissions.join(", ")}]`,
  });
  res.json({
    success: true,
    message: updated.modifiedCount
      ? `Role saved. ${updated.modifiedCount} staff account(s) updated.`
      : "Role saved",
    role,
  });
});

// @route DELETE /api/admin/roles/:id
export const deleteRole = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw badRequest("Invalid role");
  const role = await AdminRole.findById(req.params.id);
  if (!role) throw notFound("Role not found");
  const inUse = await User.countDocuments({ role: "Admin", adminRole: role._id });
  if (inUse)
    throw badRequest(`${inUse} staff account(s) use this role. Move them to another role first.`);
  await role.deleteOne();
  await audit(req, "role.delete", {
    entityType: "AdminRole",
    entityId: role._id,
    summary: role.name,
  });
  res.json({ success: true, message: "Role deleted" });
});

/**
 * Resolves the access a staff form asked for: a named role (copied onto the account) or a
 * custom set. Returns the fields to set on the user.
 */
export async function resolveStaffAccess(body) {
  if (body.adminRole) {
    if (!isObjectId(body.adminRole)) throw badRequest("Choose a valid role");
    const role = await AdminRole.findById(body.adminRole).lean();
    if (!role) throw badRequest("That role no longer exists");
    return {
      adminRole: role._id,
      permissions: role.permissions,
      viewPermissions: role.viewPermissions,
    };
  }
  return { adminRole: null, ...readAccess(body) };
}
