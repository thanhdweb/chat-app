import { useContext, useEffect, useRef, useState } from "react";
import assets from "../assets/assets";
import { formatMessageTime } from "../lib/utils";
import { AuthContext } from "../../context/AuthContext";
import { ChatContext } from "../../context/ChatContext";
import toast from "react-hot-toast";
import Swal from "sweetalert2";

// import icon
import { FaArrowLeft } from "react-icons/fa";
import { AiFillInfoCircle } from "react-icons/ai";

const ChatContainer = () => {
  const { messages, setMessages, selectedUser, setSelectedUser, sendMessage, getMessages, deleteAllMessages, deleteMessageById, socket } =
    useContext(ChatContext);
  const { authUser, onlineUsers, deleteUser } = useContext(AuthContext);

  const [input, setInput] = useState("");

  // Xử lý việc gửi tin nhắn
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (input.trim() === "") return null;
    await sendMessage({ text: input.trim() });
    setInput("");
  };

  // Xử lý xóa cuộc trò chuyện
  const handleDeleteUser = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    const result = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes !",
    });

    if (result.isConfirmed) {
      try {
        await deleteUser(selectedUser._id);
        setSelectedUser(null);
        Swal.fire("Deleted!", "User has been deleted.", "success");
      } catch (error) {
        const message = error.response?.data?.message || error.message || "Failed to delete user.";
        Swal.fire("Error!", message, "error");
      }
    }
  };

  // xử lý xóa all tin nhắn
  const handleDeleteAllMessages = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    const result = await Swal.fire({
      title: "Are you sure?",
      text: "This will delete all messages with this user.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes !",
    });

    if (result.isConfirmed) {
      try {
        await deleteAllMessages();
      } catch (error) {
        console.log(error);
      }
    }
  }

  // xử lý xóa tin nhắn riêng lẻ
  const handleMessageLongPress = (msg) => {
    if (msg.senderId !== authUser._id) return;

    let pressTimer;

    const start = () => {
      pressTimer = setTimeout(() => {
        Swal.fire({
          title: "Delete this message?",
          text: "This action cannot be undone.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Yes !",
        }).then(async (result) => {
          if (result.isConfirmed) {
            try {
              await deleteMessageById(msg._id);
            } catch (error) {
              console.log(error);
            }
          }
        });
      }, 600); // 600ms for long press
    }
    const cancel = () => clearTimeout(pressTimer);

    // trả về object handler để gắn vào thẻ
    return {
      onMouseDown: start,
      onTouchStart: start,
      onMouseUp: cancel,
      onTouchEnd: cancel,
      onMouseLeave: cancel,
    };
  }

  // cập nhật UI sao khi xóa tin nhắn 2 bên
  useEffect(() => {
    socket.on("messageDeleted", ({ messageId }) => {
      setMessages(prevMessages => prevMessages.filter(msg => msg._id !== messageId));
    });

    return () => {
      socket.off("messageDeleted");
    };
  }, [socket]);


  // Xử lý gửi hình ảnh
  const handleSendImage = async (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith("image/")) {
      toast.error("select an image file");
      return;
    }
    const reader = new FileReader();

    reader.onloadend = async () => {
      await sendMessage({ image: reader.result });
      e.target.value = "";
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (selectedUser) {
      getMessages(selectedUser._id);
    }
  }, [selectedUser]);

  // ẩn dropdown menu khi click ra ngoài
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef();

  useEffect(() => {
    const handler = e => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  // tạo thanh cuộn chat mượn mà
  const scrollEnd = useRef();
  useEffect(() => {
    if (scrollEnd.current && messages) {
      scrollEnd.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);



  return selectedUser ? (
    <div className="h-full overflow-scroll relative backdrop-blur-lg">
      {/* header--------------- */}
      <div className="flex items-center gap-5 py-3 mx-4 border-b border-stone-500">
        <FaArrowLeft onClick={() => setSelectedUser(null)} className="text-white text-lg md:hidden" />
        <img
          src={selectedUser.profilePic || assets.avatar_icon}
          alt=""
          className="w-10 h-10 rounded-full"
        />
        <p className="flex-1 text-lg text-white flex items-center gap-2">
          {selectedUser.fullName}
          {onlineUsers.includes(selectedUser._id) && (
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
          )}
        </p>
        <div ref={dropdownRef} className="relative">
          <AiFillInfoCircle onClick={() => setShowDropdown(!showDropdown)} className="text-white text-2xl cursor-pointer" />
          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="absolute top-full right-0 w-42 p-3 bg-[#282142] border border-gray-600 text-gray-100 shadow-lg rounded-md z-10">
              <button
                onClick={handleDeleteUser}
                className="block w-full text-left text-sm text-white"
              >
                Delete conversation
              </button>
              <hr className="my-2 border-t border-gray-500" />
              <button
                onClick={handleDeleteAllMessages}
                className="block w-full text-left text-sm text-white"
              >
                Delete all messages
              </button>
            </div>
          )}
        </div>
      </div>
      {/* chat area------------- */}
      <div className="flex flex-col h-[calc(100%-120px)] overflow-y-scroll p-3 pb-6">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex items-end gap-2 justify-end ${msg.senderId !== authUser._id && "flex-row-reverse"
              }`}
          >
            {msg.image ? (
              <img
                src={msg.image}
                alt=""
                className="max-w-[230px] border border-gray-700 rounded-lg overflow-hidden mb-8"
              />
            ) : (
              <p {...handleMessageLongPress(msg)}
                className={`font-inter p-2 max-w-[200px] md:text-sm font-light rounded-lg mb-8 break-words bg-violet-500/30 text-white ${msg.senderId === authUser._id
                  ? "rounded-br-none"
                  : "rounded-bl-none"
                  }`}
              >
                {msg.text}
              </p>
            )}

            <div className="text-center text-xs">
              <img
                src={
                  msg.senderId === authUser._id
                    ? authUser._id?.profilePic || assets.avatar_icon
                    : selectedUser?.profilePic || assets.avatar_icon
                }
                alt=""
                className="w-7 rounded-full"
              />
              <p className="text-gray-500">
                {formatMessageTime(msg.createdAt)}
              </p>
            </div>
          </div>
        ))}
        <div ref={scrollEnd}></div>
      </div>
      {/* bottom area----------- */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center gap-3 p-3">
        <div className="flex-1 flex items-center bg-gray-100/12 px-3 rounded-full">
          <input
            onChange={(e) => setInput(e.target.value)}
            value={input}
            onKeyDown={(e) => (e.key === "Enter" ? handleSendMessage(e) : null)}
            type="text"
            placeholder="Send a message"
            className="font-inter flex-1 text-sm p-3 border-none rounded-lg outline-none text-white placeholder-gray-400"
          />
          <input
            onChange={handleSendImage}
            type="file"
            id="image"
            accept="image/png, image/jpg, image/jpeg"
            hidden
          />
          <label htmlFor="image">
            <img
              src={assets.gallery_icon}
              alt=""
              className="w-5 mr-2 cursor-pointer"
            />
          </label>
        </div>
        <img
          onClick={handleSendMessage}
          src={assets.send_button}
          alt=""
          className="w-7 cursor-pointer"
        />
      </div>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center gap-2 text-gray-500 bg-white/10 max-md:hidden">
      <img src={assets.logo_icon} alt="" className="max-w-16" />
      <p className="text-lg font-medium text-white">Chat anytime, anywhere</p>
    </div>
  );
};

export default ChatContainer;
