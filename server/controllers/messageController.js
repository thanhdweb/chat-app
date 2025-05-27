import User from "../models/User.js";
import Message from "../models/Message.js";
import cloudinary from "../lib/cloudinary.js";
import { io, userSocketMap } from "../server.js";

// Get all user except(ngoai tru) the logged in user
export const getUsersForSidebar = async (req, res) => {
  try {
    const userId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: userId } }).select(
      "-password"
    );

    // Count number of message not seen
    const unseenMessages = {};
    const promises = filteredUsers.map(async (user) => {
      const message = await Message.find({
        senderId: user._id,
        receiverId: userId,
        seen: false,
      });

      if (message.length > 0) {
        unseenMessages[user._id] = message.length;
      }
    });

    await Promise.all(promises);
    res.json({ success: true, users: filteredUsers, unseenMessages });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: filteredUsers, unseenMessages });
  }
};

// Get all messages for selected user
export const getMessages = async (req, res) => {
  try {
    const { id: selectedUserId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: selectedUserId },
        { senderId: selectedUserId, receiverId: myId },
      ],
    });

    await Message.updateMany(
      { senderId: selectedUserId, receiverId: myId },
      { seen: true }
    );

    res.json({ success: true, messages });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

// api to mark(danh dau) message as seen using message id
export const markMessageAsSeen = async (req, res) => {
  try {
    const { id } = req.params;
    await Message.findByIdAndUpdate(id, { seen: true });
    res.json({ success: true });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

// Send message to selected user
export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const receiverId = req.params.id;
    const senderId = req.user._id;

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = await Message.create({
      senderId,
      receiverId,
      text,
      image: imageUrl,
    });

    // Emit the new message to the receiver's socket
    const receiverSocketId = userSocketMap[receiverId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.json({ success: true, newMessage });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

// Xóa toàn bộ tin nhắn giữa user hiện tại và user được chọn
export const deleteAllMessages = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: selectedUserId } = req.params;

    await Message.deleteMany({
      $or: [
        { senderId: myId, receiverId: selectedUserId },
        { senderId: selectedUserId, receiverId: myId },
      ],
    });

    // Gửi socket cho người kia nếu đang online
    const receiverSocketId = userSocketMap[selectedUserId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messagesDeleted", { by: myId });
    }

    res.json({ success: true, message: "All messages deleted." });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: "Failed to delete messages." });
  }
};

// Xóa tin nhắn theo riêng lẻ id
export const deleteMessageById = async (req, res) => {
  try {
    const messageId = req.params.id;
    const { userId } = req.body;

    const message = await Message.findById(messageId);
    if (!message) {
      return res
        .status(404)
        .json({ success: false, message: "Message not found." });
    }

    if (message.senderId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own messages.",
      });
    }

    // Lấy thông tin người nhận tin nhắn (để emit socket)
    const receiverId = message.receiverId.toString(); // giả sử bạn có trường receiverId

    await Message.findByIdAndDelete(messageId);

    // PHÁT SỰ KIỆN SOCKET NGAY SAU KHI XÓA THÀNH CÔNG
    // userSocketMap là map userId => socketId (bạn lưu ở đâu đó trong server socket)
    const receiverSocketId = userSocketMap[receiverId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageDeleted", { messageId });
    }

    return res.json({
      success: true,
      message: "Message deleted successfully.",
    });
  } catch (error) {
    console.log(error.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete message." });
  }
};
