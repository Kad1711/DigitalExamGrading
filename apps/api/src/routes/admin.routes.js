import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";

const router = Router();

/**
 * GET /api/admin/test
 * Chi ADMIN truy cap duoc. Dung de verify RBAC.
 */
router.get("/test", authenticate, authorizeRoles("ADMIN"), (req, res) => {
  res.status(200).json({
    success: true,
    message: "RBAC OK - ban la ADMIN.",
    data: { user: req.user },
  });
});

export default router;