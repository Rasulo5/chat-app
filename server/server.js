import express from "express";
import "dotenv/config";
import cors from "cors";
import http from "http";
import { connectDB } from "./lib/db.js";
import userRouter from "./routes/userRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import { Server } from "socket.io";

//Create Express app and HTTP server

const app = express();
const server = http.createServer(app);

// Initialize Socket.io server
export const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    credentials: true,
  },
});

// Store online users
export const userSocketMap = {}; // { userId: socketId }

// Socket.io connection handler
io.on("connection", (socket) => {
  //При подключении нового клиента извлекается userId из query-параметров
  const userId = socket.handshake.query.userId;
  console.log("User connected", userId);

  if (userId) {
    //Записывается соответствие userId → socket.id в объект userSocketMap
    userSocketMap[userId] = socket.id;
  }
  // Emit online users to all connected clients
  //Сразу после подключения всем клиентам рассылается массив ID пользователей в сети
  //Object.keys(userSocketMap) возвращает все ключи объекта (т.е. все userId)
  io.emit("getOnlineUsers", Object.keys(userSocketMap));
  //Обработка отключения

  socket.on("disconnect", () => {
    console.log("User Disconnected", userId);
    if (userId) {
      //При отключении клиента удаляется запись из userSocketMap
      delete userSocketMap[userId];
      //Всем клиентам рассылается обновлённый список онлайн-пользователей
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
    }
  });
});

//Middleware setup
app.use(express.json({ limit: "8mb" }));
app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true,
  })
);

//Routes setup
app.use("/api/status", (req, res) => res.send("Server is live"));
app.use("/api/auth", userRouter);
app.use("/api/message", messageRouter);

//Connect to MongoDB
const startServer = async () => {
  try {
    await connectDB();
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () =>
      console.log(`Server is running on PORT: ${PORT}`)
    );
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
