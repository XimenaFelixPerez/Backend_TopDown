import { Router } from "express";
const router = Router();
import { getUsers, getUser, postUsers, postUser, putUser, deleteUser } from "../Controllers/users.Controllers.js";

router.get("/users", getUsers);
router.get("/users/:id", getUser);
router.post("/users", postUsers);
router.put("/users/:id", putUser);
router.delete("/users/:id", deleteUser);

export default router;