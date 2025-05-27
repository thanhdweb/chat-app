import express from "express";
import { protectRoute } from "../middleware/auth.js";
import {
  deleteAllMessages,
  deleteMessageById,
  getMessages,
  getUsersForSidebar,
  markMessageAsSeen,
  sendMessage,
} from "../controllers/messageController.js";

const messageRouter = express.Router();

messageRouter.get("/users", protectRoute, getUsersForSidebar);
messageRouter.get("/:id", protectRoute, getMessages);
messageRouter.put("/mark/:id", protectRoute, markMessageAsSeen);
messageRouter.post("/send/:id", protectRoute, sendMessage);
messageRouter.delete("/delete-messages/:id", protectRoute, deleteAllMessages);
messageRouter.delete("/delete-message/:id", protectRoute, deleteMessageById);

export default messageRouter;
