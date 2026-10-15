import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import session from "express-session";
import loginRoutes from "./routes/login.route.js";
import indexRoutes from "./routes/index.routes.js";
import usersRoutes from "./routes/users.route.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de CORS para permitir solicitudes del Frontend con cookies/sesiones
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "http://localhost:8080"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || "default_session_secret_topdown",
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    maxAge: 5 * 60 * 1000,
    httpOnly: true,
    sameSite: "lax",
    secure: false
  }
}));

// Rutas API
app.use("/api", loginRoutes);
app.use("/api", indexRoutes);
app.use("/api", usersRoutes);

app.get("/", (req, res) => {
  res.json({
    mensaje: "API Backend de Kiosco TopDown funcionando correctamente",
    estado: "activo",
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Servidor Backend corriendo en http://localhost:${PORT}`);
});