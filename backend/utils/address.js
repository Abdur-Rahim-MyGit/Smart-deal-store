import { EMIRATES } from "../models/User.js";
import { badRequest, pick } from "./http.js";
import { assertPhone, normalizePhone, requireFields } from "./validation.js";

const ADDRESS_FIELDS = [
  "receiverName",
  "receiverPhone",
  "emirate",
  "area",
  "street",
  "buildingDetails",
  "landmark",
];

/** Validates a UAE address payload from the client. */
export function readAddressInput(body = {}) {
  requireFields(body, [
    "receiverName",
    "receiverPhone",
    "emirate",
    "area",
    "street",
    "buildingDetails",
  ]);
  const receiverPhone = normalizePhone(body.receiverPhone);
  assertPhone(receiverPhone);
  if (!EMIRATES.includes(body.emirate)) throw badRequest("Please choose a valid emirate");

  return {
    receiverName: String(body.receiverName).trim(),
    receiverPhone,
    emirate: body.emirate,
    area: String(body.area).trim(),
    street: String(body.street).trim(),
    buildingDetails: String(body.buildingDetails).trim(),
    landmark: body.landmark ? String(body.landmark).trim() : undefined,
    addressType: ["Home", "Office", "Other"].includes(body.addressType) ? body.addressType : "Home",
  };
}

/** Copy of an address frozen onto an order. */
export const snapshotAddress = (address) => pick(address, ADDRESS_FIELDS);
