require("dotenv").config();

for (const key of ["MONGO_URI", "JWT_SECRET", "REDIS_HOST"]) {
  if (!process.env[key]) console.warn(`⚠️  Missing env var: ${key}`);
}

// The worker runs inside this process by default (needed on hosts with no
// background workers, e.g. Render free tier). Set RUN_WORKER=false to run it
// separately with `npm run worker`.
if (process.env.RUN_WORKER !== "false") require("./worker");
const connectDB = require("./db");
connectDB();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { QueueEvents } = require("bullmq");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const codeExecutionQueue = require("./queue");
const authRoutes = require("./routes/auth");
const sessionRoutes = require("./routes/sessions");
const Session = require("./models/Session");
const User = require("./models/User");
const {
  sanitizeProblemForRole,
  sanitizeResultForRole,
} = require("./utils/sanitize");

const app = express();
// Behind Render/Vercel proxies: without this every user shares one IP and
// express-rate-limit throttles everyone together.
app.set("trust proxy", 1);
const server = http.createServer(app);

// Restrict to the actual frontend origin(s). Supports a comma-separated
// list in CLIENT_URL for multiple environments (e.g. local + deployed).
// Falls back to "*" only if CLIENT_URL isn't set, with a loud warning —
// don't ship to production without setting this.
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",").map((o) => o.trim())
  : "*";

if (allowedOrigins === "*") {
  console.warn(
    "⚠️  CLIENT_URL is not set — CORS is allowing all origins. Set CLIENT_URL in production.",
  );
}

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server is running");
});
app.use("/api/auth", authRoutes);
app.use("/api/sessions", sessionRoutes);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
  },
});

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Authentication error: no token provided"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return next(new Error("Authentication error: user not found"));
    }

    socket.userId = decoded.userId;
    socket.userName = user.name;
    next();
  } catch (err) {
    next(new Error("Authentication error: invalid token"));
  }
});

const connection = require("./redisConnection");

const queueEvents = new QueueEvents("code-execution", { connection });

queueEvents.on("completed", async ({ jobId, returnvalue }) => {
  try {
    const job = await codeExecutionQueue.getJob(jobId);
    const room = job.data.room;

    console.log(`Job ${jobId} completed, sending result to room ${room}`);

    const socketsInRoom = await io.in(room).fetchSockets();
    for (const s of socketsInRoom) {
      s.emit("code-result", sanitizeResultForRole(returnvalue, s.role));
    }
  } catch (err) {
    console.error("Failed to handle completed job:", err);
  }
});

const saveTimers = {};
const pendingCode = {};

async function flushSave(room) {
  if (saveTimers[room]) {
    clearTimeout(saveTimers[room]);
    delete saveTimers[room];
  }
  if (pendingCode[room] === undefined) return;
  const code = pendingCode[room];
  delete pendingCode[room];
  try {
    await Session.findOneAndUpdate({ roomId: room }, { code });
    console.log(`Saved code for room ${room}`);
  } catch (err) {
    console.error("Failed to save code:", err);
  }
}
const roomUsers = {};

// A socket is only allowed to act on a room if it successfully joined that
// exact room via join-room (which sets currentRoom + role). This stops a
// connected-but-unauthorized socket from emitting events for a room it was
// never granted access to.
function isAuthorizedForRoom(socket, room) {
  return (
    socket.currentRoom === room &&
    (socket.role === "interviewer" || socket.role === "candidate")
  );
}

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("join-room", async (roomName) => {
    try {
      const session = await Session.findOne({ roomId: roomName }).populate(
        "problem",
      );

      if (!session) {
        socket.emit("join-error", { message: "Session not found" });
        return;
      }

      let role = null;

      if (String(session.createdBy) === String(socket.userId)) {
        role = "interviewer";
      } else if (
        session.candidate &&
        String(session.candidate) === String(socket.userId)
      ) {
        role = "candidate";
      } else if (!session.candidate) {
        // Two people could hit this branch at the same instant, so the
        // candidate slot is claimed with an atomic conditional update
        // instead of "read session, mutate, save" (which had a race).
        const claimed = await Session.findOneAndUpdate(
          { roomId: roomName, candidate: null },
          { candidate: socket.userId, status: "active" },
          { new: true },
        );

        if (claimed && String(claimed.candidate) === String(socket.userId)) {
          role = "candidate";
          session.candidate = claimed.candidate;
          session.status = claimed.status;
        }
        // else: someone else claimed the slot a moment earlier — role stays null
      }

      // Anyone who isn't the interviewer or the assigned candidate is not
      // authorized for this session. Reject before joining the socket.io
      // room, so they never receive code changes, chat, or run results,
      // and can never emit run-code / send-code-change for this room.
      if (!role) {
        socket.emit("join-error", {
          message: "You are not authorized to join this session.",
        });
        return;
      }

      socket.join(roomName);
      socket.currentRoom = roomName;
      socket.role = role;
      console.log(`Socket ${socket.id} joined room: ${roomName} as ${role}`);

      if (!roomUsers[roomName]) {
        roomUsers[roomName] = {};
      }
      roomUsers[roomName][socket.id] = socket.userName;
      io.to(roomName).emit("room-users", Object.values(roomUsers[roomName]));

      socket.emit("session-info", {
        role,
        problem: sanitizeProblemForRole(session.problem, role),
        status: session.status,
      });

      if (session.code) {
        socket.emit("load-code", session.code);
      }
    } catch (err) {
      console.error("Failed to load session:", err);
      socket.emit("join-error", { message: "Failed to join session" });
    }
  });

  socket.on("send-message", (data) => {
    if (!isAuthorizedForRoom(socket, data.room)) return;

    io.to(data.room).emit("receive-message", {
      user: socket.userName,
      message: data.message,
    });
  });

  socket.on("send-code-change", (data) => {
    if (!isAuthorizedForRoom(socket, data.room)) return;

    io.to(data.room).emit("receive-code-change", data.code);

    pendingCode[data.room] = data.code;
    if (saveTimers[data.room]) clearTimeout(saveTimers[data.room]);
    saveTimers[data.room] = setTimeout(() => flushSave(data.room), 5000);
  });

  socket.on("send-language-change", (data) => {
    if (!isAuthorizedForRoom(socket, data.room)) return;

    socket.to(data.room).emit("receive-language-change", data.language);
  });

  socket.on("run-code", async (data) => {
    if (!isAuthorizedForRoom(socket, data.room)) return;

    const now = Date.now();
    if (socket.lastRun && now - socket.lastRun < 3000) {
      socket.emit("code-result", {
        mode: "raw",
        success: false,
        output: "Slow down — wait a few seconds between runs.",
      });
      return;
    }
    socket.lastRun = now;

    console.log("Run code requested for room:", data.room);
    try {
      const session = await Session.findOne({ roomId: data.room }).populate(
        "problem",
      );
      const testCases = session?.problem?.testCases || [];

      const job = await codeExecutionQueue.add("run-code", {
        code: data.code,
        room: data.room,
        language: data.language,
        testCases,
      });
      console.log("Job added:", job.id);
    } catch (err) {
      console.error("Failed to queue run-code:", err);
    }
  });

  socket.on("cursor-move", (data) => {
    if (!isAuthorizedForRoom(socket, data.room)) return;

    socket.to(data.room).emit("receive-cursor", {
      userId: socket.id,
      userName: socket.userName,
      position: data.position,
    });
  });

  socket.on("end-interview", async (data) => {
    if (!isAuthorizedForRoom(socket, data.room)) return;

    try {
      const session = await Session.findOne({ roomId: data.room });
      if (!session || String(session.createdBy) !== String(socket.userId))
        return;

      session.status = "completed";
      session.endedAt = new Date();
      await session.save();

      const socketsInRoom = await io.in(data.room).fetchSockets();
      for (const s of socketsInRoom) {
        if (String(s.userId) !== String(socket.userId)) {
          s.emit("interview-ended");
        } else {
          s.emit("interview-ended-self");
        }
      }
    } catch (err) {
      console.error("Failed to end interview:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);

    if (socket.currentRoom) flushSave(socket.currentRoom);

    if (socket.currentRoom && roomUsers[socket.currentRoom]) {
      delete roomUsers[socket.currentRoom][socket.id];
      io.to(socket.currentRoom).emit(
        "room-users",
        Object.values(roomUsers[socket.currentRoom]),
      );
      io.to(socket.currentRoom).emit("user-left", { userId: socket.id });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});