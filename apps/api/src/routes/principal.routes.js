import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import * as principalController from "../controllers/principal.controller.js";

const router = Router();

// All principal routes require authentication
router.use(authenticate);

const canViewAcademicStructure = authorizeRoles("SUPER_ADMIN", "PRINCIPAL");

/**
 * GET /api/principal/academic-structure
 * Read-only aggregation of school-wide academic departments, teachers, subject leaders, and teaching assignments.
 */
router.get("/academic-structure", canViewAcademicStructure, principalController.getAcademicStructureController);

export default router;
