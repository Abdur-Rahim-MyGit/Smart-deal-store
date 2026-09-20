import express from "express";
import {
  addTicketMessage,
  createTicket,
  getAllTickets,
  getMyTickets,
  getTicket,
  listSupportAgents,
  updateTicket,
} from "../controllers/ticketController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/", createTicket);
router.get("/my", getMyTickets);
router.get("/", requirePermission("support"), getAllTickets);
router.get("/agents", requirePermission("support"), listSupportAgents);
router.get("/:id", getTicket);
router.post("/:id/messages", addTicketMessage);
router.put("/:id", requirePermission("support"), updateTicket);

export default router;
