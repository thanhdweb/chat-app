import { createContext, useContext, useEffect, useState } from "react";
import { AuthContext } from "./AuthContext";
import toast from "react-hot-toast";

export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [unseenMessages, setUnseenMessages] = useState({});

  const { socket, axios, authUser } = useContext(AuthContext);

  // Function to get all users for sidebar
  const getUsers = async () => {
    try {
      const { data } = await axios.get("/api/messages/users");
      if (data.success) {
        setUsers(data.users);
        setUnseenMessages(data.unseenMessages);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  // function to get messages for selected user
  const getMessages = async (userId) => {
    try {
      const { data } = await axios.get(`/api/messages/${userId}`);
      if (data.success) {
        setMessages(data.messages);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  // function to send message to selected user
  const sendMessage = async (messageData) => {
    try {
      const { data } = await axios.post(
        `/api/messages/send/${selectedUser._id}`,
        messageData
      );
      if (data.success) {
        setMessages((prevMessages) => [...prevMessages, data.newMessage]);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  // chức năng đăng ký nhận tin nhắn cho người dùng đã chọn
  const subscribeToMessages = async () => {
    if (!socket) return;

    socket.on("newMessage", (newMessage) => {
      if (selectedUser && newMessage.senderId === selectedUser._id) {
        newMessage.seen = true;
        setMessages((prevMessages) => [...prevMessages, newMessage]);
        axios.put(`/api/messages/mark/${newMessage._id}`);
      } else {
        setUnseenMessages((prevUnseenMessages) => ({
          ...prevUnseenMessages,
          [newMessage.senderId]: prevUnseenMessages[newMessage.senderId]
            ? prevUnseenMessages[newMessage.senderId] + 1
            : 1,
        }));
      }
    });
  };


  // Xóa all messages between the current user and the selected user
  const deleteAllMessages = async () => {
    try {
      const { data } = await axios.delete(`/api/messages/delete-messages/${selectedUser._id}`);
      if (data.success) {
        setMessages([]); // Clear tin nhắn trên giao diện
      } else {
        toast.error(data.message || "Failed to delete messages");
      }
    } catch (error) {
      toast.error(error.message);
    }
  }

  // Xóa tin nhắn theo id
  const deleteMessageById = async (messageId) => {
    try {
      const { data } = await axios.delete(`/api/messages/delete-message/${messageId}`, {
        data: { userId: authUser._id },
      })

      if (data.success) {
        // cập nhât lại danh sách tin nhắn
        setMessages((prev) => prev.filter((msg) => msg._id !== messageId))
        // Gửi socket cho người kia
        socket.emit("deleteMessage", {
          messageId,
          receiverId: selectedUser._id, // người đang chat với bạn
        });
      } else {
        toast.error(data.error || "Failed to delete message");
      }
    } catch (error) {
      toast.error(error.message);
    }
  }

  // chức năng hủy đăng ký nhận tin nhắn
  const unsubscribeFromMessages = () => {
    if (socket) socket.off("newMessage");
  };

  //-------
  useEffect(() => {
    subscribeToMessages();
    return () => unsubscribeFromMessages();
  }, [socket, selectedUser]);

  // ---------


  const value = {
    messages,
    setMessages,
    users,
    selectedUser,
    getUsers,
    getMessages,
    sendMessage,
    setSelectedUser,
    unseenMessages,
    setUnseenMessages,
    deleteAllMessages,
    deleteMessageById,
    socket
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
