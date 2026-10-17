import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import session from "express-session";

import loginRoutes from "./routes/login.route.js";
import dashboardRoutes from "./routes/dashboard.route.js";
import nominaRoutes from "./routes/nomina.route.js";
import notificacionesRoutes from "./routes/notificaciones.route.js";
import noticiasRoutes from "./routes/noticias.routes.js";
import adminRoutes from "./routes/admin.route.js";

const app = express();
const PORT = process.env.PORT || 3000;

// CORS: permite el frontend local (live-server) con cookies de sesión
app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true
}));

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sesión de 5 minutos. "rolling" la renueva con cada petición; sin actividad, expira.
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
app.use("/api", loginRoutes);           // /login, /verificar, /logout, /yo
app.use("/api", dashboardRoutes);       // /dashboard
app.use("/api", nominaRoutes);          // /nomina/...
app.use("/api", notificacionesRoutes);  // /notificaciones
app.use("/api", noticiasRoutes);        // /noticias
app.use("/api", adminRoutes);           // /admin/...  (solo admin)

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
