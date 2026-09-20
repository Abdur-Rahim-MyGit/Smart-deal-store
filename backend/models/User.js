import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export const EMIRATES = [
  "Dubai",
  "Abu Dhabi",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah",
];

// Admin console modules a non-super admin can be granted access to.
export const ADMIN_PERMISSIONS = [
  "orders",
  "products",
  "customers",
  "vendors",
  "marketing",
  "reviews",
  "support",
  "finance",
  "settings",
];

const AddressSchema = new mongoose.Schema(
  {
    receiverName: { type: String, required: true, trim: true },
    receiverPhone: { type: String, required: true, trim: true },
    emirate: { type: String, required: true, enum: EMIRATES },
    area: { type: String, required: true, trim: true },
    street: { type: String, required: true, trim: true },
    buildingDetails: { type: String, required: true, trim: true }, // Building, floor, apartment or villa number
    landmark: { type: String, trim: true },
    addressType: { type: String, enum: ["Home", "Office", "Other"], default: "Home" },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// A seller verification document stored privately (see vendorDocumentController).
const VendorDocumentSchema = new mongoose.Schema(
  {
    file: { type: String }, // Stored file name (random; never a public URL)
    originalName: { type: String },
    mimeType: { type: String },
    size: { type: Number },
    uploadedAt: { type: Date },
    expiresAt: { type: Date },
  },
  { _id: false },
);

// One entry per signed-in device so logging out on one device doesn't end the others.
const SessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true },
    // The token this one replaced stays valid for a short grace window so two
    // tabs refreshing at the same moment don't sign each other out.
    previousHash: { type: String },
    rotatedAt: { type: Date },
    userAgent: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Please enter a valid email"],
    },
    phone: {
      type: String,
      unique: true,
      sparse: true, // Google sign-ups may not have a phone yet
      trim: true,
      match: [/^\+971\d{8,9}$/, "Please enter a valid UAE phone number (+971XXXXXXXXX)"],
    },
    password: { type: String, required: true, minlength: 8, select: false },
    avatar: { type: String },
    gender: { type: String, enum: ["Male", "Female", "Prefer not to say"] },
    role: { type: String, enum: ["Customer", "Vendor", "Admin"], default: "Customer" },
    status: { type: String, enum: ["Active", "Blocked"], default: "Active" },

    // RBAC for the admin console
    isSuperAdmin: { type: Boolean, default: false },
    permissions: [{ type: String, enum: ADMIN_PERMISSIONS }], // Can view and change
    viewPermissions: [{ type: String, enum: ADMIN_PERMISSIONS }], // Can only view
    adminRole: { type: mongoose.Schema.Types.ObjectId, ref: "AdminRole" }, // Unset = custom access
    // Two-step sign-in (authenticator app). Secrets are encrypted and never selected by default.
    mfa: {
      enabled: { type: Boolean, default: false },
      secret: { type: String, select: false },
      pendingSecret: { type: String, select: false }, // During setup, before the first code
      recoveryCodes: { type: [String], select: false }, // SHA-256 hashes of one-time codes
      lastUsedStep: { type: Number }, // Stops the same code being used twice
      enabledAt: { type: Date },
    },

    authProvider: { type: String, enum: ["local", "google"], default: "local" },
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    resetPasswordTokenHash: { type: String },
    resetPasswordExpires: { type: Date },

    otp: {
      code: { type: String },
      expiresAt: { type: Date },
      attempts: { type: Number, default: 0 },
      cooldownUntil: { type: Date },
    },

    loginAttempts: { type: Number, default: 0 },
    firstFailedLoginAt: { type: Date }, // Start of the current failed sign-in window
    lockUntil: { type: Date },
    lastLoginAt: { type: Date },
    lastActiveAt: { type: Date }, // Last authenticated request, at most once per 10 minutes
    // Where the account came from (utm_source, referrer host, "direct", "google", "phone"…).
    signupSource: { type: String, trim: true, lowercase: true, maxlength: 60 },
    deletedAt: { type: Date }, // Set when an admin deletes (anonymises) a customer account

    addresses: [AddressSchema],
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],

    notificationPrefs: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false },
    },

    vendorDetails: {
      businessName: { type: String, trim: true },
      tradeLicenseNumber: { type: String, trim: true },
      corporateAddress: { type: String, trim: true },
      vatNumber: { type: String, trim: true },
      storeDescription: { type: String, trim: true },
      supportEmail: { type: String, trim: true },
      supportPhone: { type: String, trim: true },
      bankAccount: {
        bankName: { type: String, trim: true },
        accountName: { type: String, trim: true },
        accountNumber: { type: String, trim: true },
        iban: { type: String, trim: true },
      },
      isApproved: { type: Boolean, default: false },
      status: {
        type: String,
        enum: ["Pending Review", "Active", "Rejected", "Suspended"],
        default: "Pending Review",
      },
      rejectionReason: { type: String },
      commissionRateOverride: { type: Number, min: 0, max: 100 },
      documents: {
        tradeLicense: VendorDocumentSchema,
        vatCertificate: VendorDocumentSchema,
      },
    },

    // Store credit for customers. Vendor balances are computed from delivered orders.
    walletBalance: { type: Number, default: 0 },

    sessions: [SessionSchema],
  },
  { timestamps: true },
);

UserSchema.index({ role: 1, createdAt: -1 });
UserSchema.index({ lastActiveAt: -1 });

UserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

UserSchema.methods.matchPassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

/** "edit" access can change things in a console module; "view" access can only look. */
UserSchema.methods.hasPermission = function (permission, level = "edit") {
  if (this.role !== "Admin") return false;
  if (this.isSuperAdmin || this.permissions.includes(permission)) return true;
  return level === "view" && (this.viewPermissions || []).includes(permission);
};

// Never leak credentials, session hashes or OTP state in API responses.
UserSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.password;
    delete ret.sessions;
    delete ret.otp;
    delete ret.verificationToken;
    delete ret.resetPasswordTokenHash;
    delete ret.resetPasswordExpires;
    delete ret.loginAttempts;
    delete ret.firstFailedLoginAt;
    delete ret.lockUntil;
    ret.mfaEnabled = Boolean(ret.mfa?.enabled);
    for (const doc of Object.values(ret.vendorDetails?.documents ?? {})) {
      if (doc) delete doc.file; // Served through the documents endpoints only
    }
    delete ret.mfa;
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.model("User", UserSchema);
export default User;
