import Message from "../models/Message.js";
import User from "../models/User.js";
import cloudinary from "../lib/cloudinary.js";
import { io, userSocketMap } from "../server.js";

/* Назначение: Получение списка пользователей для боковой панели чата с количеством непрочитанных сообщений. */

// Get all users except the logged in user
export const getUsersForSidebar = async (req, res) => {
  try {
    //Получает ID текущего пользователя из req.user._id
    const userId = req.user._id;
    //Находит всех пользователей кроме текущего (используя $ne - not equal)
    const filteredUsers = await User.find({ _id: { $ne: userId } }).select(
      "-password"
    );

    //Count number of messages not seen
    const unseenMessages = {};
    //Возвращает список пользователей (без паролей) и объект с количеством непрочитанных сообщений
    const promises = filteredUsers.map(async (user) => {
      const messages = await Message.find({
        senderId: user._id,
        receiverId: userId,
        //Для каждого пользователя подсчитывает количество непрочитанных сообщений (seen: false)
        seen: false,
      });
      if (messages.length > 0) {
        unseenMessages[user._id] = messages.length;
      }
    });
    //Оптимизация: Использует Promise.all для параллельного выполнения запросов подсчета сообщений.
    await Promise.all(promises);
    res.json({ success: true, users: filteredUsers, unseenMessages });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

//Get all messages for selected user
//Назначение: Получение истории переписки между текущим пользователем и выбранным пользователем.
export const getMessages = async (req, res) => {
  try {
    //Получает ID выбранного пользователя из параметров запроса
    const { id: selectedUserId } = req.params;
    //ID текущего пользователя
    const myId = req.user._id;
    //Использует сложное условие для получения двусторонней переписки:
    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: selectedUserId },
        { senderId: selectedUserId, receiverId: myId },
      ],
    });
    //Обновление статуса
    //Помечает все входящие сообщения как прочитанные (seen: true)
    await Message.updateMany(
      { senderId: selectedUserId, receiverId: myId },
      { seen: true }
    );
    //Возвращает список сообщений
    res.json({ success: true, messages });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

//Назначение: Пометить конкретное сообщение как прочитанное.
//api to mark message as seen using message id
export const markMessageAsSeen = async (req, res) => {
  try {
    //Получает ID сообщения из параметров запроса
    const { id } = req.params;
    //Обновляет статус сообщения на seen: true
    await Message.findByIdAndUpdate(id, { seen: true });
    //Возвращает статус успешного выполнения
    res.json({ success: true });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

//Send message to selected user
export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const receiverId = req.params.id;
    const senderId = req.user._id;

    let imageUrl;
    if (image) {
      //Загружает изображение в Cloudinary
      const uploudResponse = await cloudinary.uploader.upload(image);
      //Сохраняет secure_url в базу данных
      imageUrl = uploudResponse.secure_url;
    }
    //Создание сообщения:
    const newMessage = await Message.create({
      senderId,
      receiverId,
      text,
      image: imageUrl,
    });

    // Emit the message to the receiver's socket
    //userSocketMap хранит соответствие userId → socketId
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
