import crypto from "crypto";
import Ticket, { TICKET_CATEGORIES, TICKET_STATUSES } from "../models/Ticket.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import {
  asyncHandler,
  badRequest,
  escapeRegex,
  forbidden,
  isObjectId,
  notFound,
  paginated,
  parsePagination,
} from "../utils/http.js";
import { audit, notify } from "../utils/notify.js";
import { notifyAdmins } from "../services/orderService.js";
import { sendTemplated } from "../services/notificationService.js";

const POPULATE = [
  { path: "user", select: "name email role" },
  { path: "messages.sender", select: "name role" },
  { path: "order", select: "orderId" },
  { path: "assignedAgent", select: "name" },
];

const isSupportAgent = (user, level = "edit") =>
  user.role === "Admin" && user.hasPermission("support", level);

async function createWithUniqueId(data) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const ticketId = `SD-TKT-${date}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    try {
      return await Ticket.create({ ...data, ticketId });
    } catch (error) {
      if (error?.code === 11000 && error.keyPattern?.ticketId) continue;
      throw error;
    }
  }
  throw new Error("Could not create the ticket, please try again");
}

async function loadAccessibleTicket(req) {
  if (!isObjectId(req.params.id)) throw notFound("Ticket not found");
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) throw notFound("Ticket not found");
  if (String(ticket.user) !== String(req.user._id) && !isSupportAgent(req.user, "view"))
    throw notFound("Ticket not found");
  return ticket;
}

// @route POST /api/tickets
export const createTicket = asyncHandler(async (req, res) => {
  const subject = String(req.body.subject || "").trim();
  const message = String(req.body.message || "").trim();
  if (subject.length < 4) throw badRequest("Please add a short subject");
  if (message.length < 10) throw badRequest("Please describe the issue in a little more detail");
  if (!TICKET_CATEGORIES.includes(req.body.category)) throw badRequest("Please choose a category");

  let order;
  if (req.body.orderId) {
    order = await Order.findOne({
      user: req.user._id,
      ...(isObjectId(req.body.orderId)
        ? { _id: req.body.orderId }
        : { orderId: String(req.body.orderId).trim().toUpperCase() }),
    }).select("_id");
    if (!order) throw badRequest("We couldn't find that order on your account");
  }

  const ticket = await createWithUniqueId({
    user: req.user._id,
    order: order?._id,
    subject: subject.slice(0, 150),
    category: req.body.category,
    priority: ["Low", "Medium", "High"].includes(req.body.priority) ? req.body.priority : "Medium",
    messages: [{ sender: req.user._id, message: message.slice(0, 4000) }],
  });

  await notifyAdmins("support", {
    type: "support",
    title: "New support ticket",
    message: `${ticket.ticketId}: ${ticket.subject}`,
    link: "/admin-dashboard?tab=tickets",
  });

  res.status(201).json({
    success: true,
    message: "Ticket created. Our team usually replies within a few hours.",
    ticket: await ticket.populate(POPULATE),
  });
});

// @route GET /api/tickets/my
export const getMyTickets = asyncHandler(async (req, res) => {
  const tickets = await Ticket.find({ user: req.user._id })
    .sort({ updatedAt: -1 })
    .populate(POPULATE)
    .lean();
  res.json({ success: true, tickets, categories: TICKET_CATEGORIES });
});

// @route GET /api/tickets/:id
export const getTicket = asyncHandler(async (req, res) => {
  const ticket = await loadAccessibleTicket(req);
  res.json({ success: true, ticket: await ticket.populate(POPULATE) });
});

// @route POST /api/tickets/:id/messages — body: { message }
export const addTicketMessage = asyncHandler(async (req, res) => {
  const message = String(req.body.message || "").trim();
  if (!message) throw badRequest("Write a message first");

  const ticket = await loadAccessibleTicket(req);
  // View-only support staff can read other people's tickets but not reply to them.
  if (String(ticket.user) !== String(req.user._id) && !isSupportAgent(req.user))
    throw forbidden("Your admin role can view support tickets but not reply to them");
  if (ticket.status === "Closed")
    throw badRequest("This ticket is closed. Please open a new ticket if you still need help.");

  const fromAgent = isSupportAgent(req.user) && String(ticket.user) !== String(req.user._id);
  ticket.messages.push({ sender: req.user._id, message: message.slice(0, 4000) });
  if (fromAgent) {
    // An agent's reply means someone is working on it.
    if (!ticket.assignedAgent) ticket.assignedAgent = req.user._id;
    if (["New", "Assigned"].includes(ticket.status)) ticket.status = "In Progress";
  } else if (ticket.status === "Resolved") {
    // The customer came back, so it needs attention again.
    ticket.status = ticket.assignedAgent ? "Assigned" : "New";
  }
  await ticket.save();

  if (fromAgent) {
    await sendTemplated(
      "ticket_reply",
      ticket.user,
      { ticketId: ticket.ticketId, excerpt: message.slice(0, 120) },
      { link: "/account?tab=support" },
    );
  } else if (ticket.assignedAgent) {
    await notify(ticket.assignedAgent, {
      type: "support",
      title: "Customer replied",
      message: `${ticket.ticketId}: ${message.slice(0, 120)}`,
      link: "/admin-dashboard?tab=tickets",
    });
  }

  res.json({ success: true, ticket: await ticket.populate(POPULATE) });
});

// @route GET /api/tickets — support agents
export const getAllTickets = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 20, 100);
  const filter = {};
  if (TICKET_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (req.query.assigned === "me") filter.assignedAgent = req.user._id;
  if (req.query.assigned === "none") filter.assignedAgent = null;
  if (["Low", "Medium", "High"].includes(req.query.priority)) filter.priority = req.query.priority;
  if (req.query.q) {
    const pattern = new RegExp(escapeRegex(String(req.query.q).trim()), "i");
    filter.$or = [{ ticketId: pattern }, { subject: pattern }];
  }

  const [tickets, total, statusCounts] = await Promise.all([
    Ticket.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).populate(POPULATE).lean(),
    Ticket.countDocuments(filter),
    Ticket.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  paginated(res, {
    items: tickets,
    key: "tickets",
    total,
    page,
    limit,
    extra: { statusCounts: Object.fromEntries(statusCounts.map((row) => [row._id, row.count])) },
  });
});

// @route GET /api/tickets/agents — support staff a ticket can be assigned to
export const listSupportAgents = asyncHandler(async (_req, res) => {
  const agents = await User.find({
    role: "Admin",
    status: "Active",
    $or: [{ isSuperAdmin: true }, { permissions: "support" }],
  })
    .select("name email")
    .sort({ name: 1 })
    .lean();
  res.json({ success: true, agents });
});

// @route PUT /api/tickets/:id — support agents; body: { status, priority, assignToMe, assignedAgent }
export const updateTicket = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) throw notFound("Ticket not found");

  const previous = ticket.status;
  const previousAgent = ticket.assignedAgent ? String(ticket.assignedAgent) : null;
  if (req.body.priority !== undefined) {
    if (!["Low", "Medium", "High"].includes(req.body.priority))
      throw badRequest("Invalid priority");
    ticket.priority = req.body.priority;
  }

  // Assignment: to yourself, to another support agent, or back to the unassigned queue.
  if (req.body.assignToMe) ticket.assignedAgent = req.user._id;
  else if (req.body.assignedAgent !== undefined) {
    if (!req.body.assignedAgent) ticket.assignedAgent = undefined;
    else {
      if (!isObjectId(req.body.assignedAgent)) throw badRequest("Choose a support agent");
      const agent = await User.findOne({
        _id: req.body.assignedAgent,
        role: "Admin",
        status: "Active",
      });
      if (!agent || !agent.hasPermission("support"))
        throw badRequest("That person can't work on support tickets");
      ticket.assignedAgent = agent._id;
    }
  }
  const agentChanged =
    previousAgent !== (ticket.assignedAgent ? String(ticket.assignedAgent) : null);
  if (agentChanged && ticket.assignedAgent && ticket.status === "New") ticket.status = "Assigned";
  if (agentChanged && !ticket.assignedAgent && ["Assigned", "In Progress"].includes(ticket.status))
    ticket.status = "New";

  if (req.body.status !== undefined) {
    if (!TICKET_STATUSES.includes(req.body.status)) throw badRequest("Invalid status");
    if (req.body.status === "Assigned" && !ticket.assignedAgent)
      throw badRequest("Assign the ticket to someone first");
    ticket.status = req.body.status;
  }
  await ticket.save();

  if (
    agentChanged &&
    ticket.assignedAgent &&
    String(ticket.assignedAgent) !== String(req.user._id)
  ) {
    await notify(ticket.assignedAgent, {
      type: "support",
      title: "Ticket assigned to you",
      message: `${ticket.ticketId}: ${ticket.subject}`,
      link: "/admin-dashboard?tab=tickets",
    });
  }
  await audit(req, "ticket.update", {
    entityType: "Ticket",
    entityId: ticket._id,
    summary: `${ticket.ticketId}: ${previous} → ${ticket.status}, ${ticket.priority} priority`,
  });

  if (previous !== ticket.status && ["Resolved", "Closed"].includes(ticket.status)) {
    await notify(ticket.user, {
      type: "support",
      title: `Ticket ${ticket.status.toLowerCase()}`,
      message: `${ticket.ticketId} "${ticket.subject}" was marked ${ticket.status.toLowerCase()}.`,
      link: "/account?tab=support",
    });
  }

  res.json({ success: true, message: "Ticket updated", ticket: await ticket.populate(POPULATE) });
});
